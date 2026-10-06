// Migración idempotente (opción A, autorizada 2026-10-06): fecha final ORIGINAL del contrato.
//
// 1. PEOPLE."finalContratoOriginal" DATE: la fecha final con la que nació el contrato.
//    Se llena UNA sola vez y el código nunca la modifica.
// 2. Trigger trg_people_final_original: al insertar (o la primera vez que se asigna
//    finalContrato) copia finalContrato → finalContratoOriginal si está vacío. Así lo
//    cubren TODOS los caminos de creación (Crear Contrato, agregar beneficiario,
//    migrar contrato, subir lote) sin tocar su código.
// 3. Backfill de filas existentes:
//    - titulares re-sincronizados el 2026-10-05 (fix-estado-titulares-null): el valor
//      previo del backup local docs/backup-estado-titulares-null-*.json;
//    - con extensionHistory: la vigenciaAnterior de la PRIMERA extensión real
//      (se ignoran las entradas CORRECCION y SINCRONIZACION);
//    - el resto: su finalContrato actual.
//    (Los OnHold no dejan extensionHistory: para esas filas el original es la fecha
//    disponible, que ya incluye los días pausados.)
// 4. Sincroniza a los titulares cuya fecha final es menor que la del beneficiario vivo
//    más extendido (misma regla que src/lib/sync-final-titular.ts), con entrada
//    tipo SINCRONIZACION en su extensionHistory.
// Dry-run por defecto; --apply para escribir. Todo en una transacción.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const APPLY = process.argv.includes('--apply');

const VIVO = `UPPER(COALESCE(b."estado",'')) NOT IN ('FINALIZADA','ANULADO','RETRACTADO')
  AND UPPER(COALESCE(b."aprobacion",'')) NOT IN ('CONTRATO NULO','DEVUELTO','RECHAZADO','RETRACTADO')
  AND (b."estadoInactivo" IS NOT TRUE OR b."fechaOnHold" IS NOT NULL)`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL lock_timeout = '5s'`);
    await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "finalContratoOriginal" DATE`);
    await c.query(`
      CREATE OR REPLACE FUNCTION people_final_original() RETURNS trigger AS $$
      BEGIN
        IF NEW."finalContratoOriginal" IS NULL AND NEW."finalContrato" IS NOT NULL
           AND (TG_OP = 'INSERT' OR OLD."finalContrato" IS NULL) THEN
          NEW."finalContratoOriginal" := NEW."finalContrato"::date;
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await c.query(`DROP TRIGGER IF EXISTS trg_people_final_original ON "PEOPLE"`);
    await c.query(`CREATE TRIGGER trg_people_final_original BEFORE INSERT OR UPDATE OF "finalContrato" ON "PEOPLE"
                   FOR EACH ROW EXECUTE FUNCTION people_final_original()`);

    // 3a. Backup del fix de ayer (titulares cuya fecha se movió).
    const backups = fs.readdirSync('docs').filter(f => /^backup-estado-titulares-null-\d+\.json$/.test(f));
    const originalPorId = new Map();
    for (const f of backups) {
      for (const item of JSON.parse(fs.readFileSync(path.join('docs', f), 'utf8'))) {
        const t = item.titular;
        if (t?._id && t.finalContrato) originalPorId.set(t._id, String(t.finalContrato).slice(0, 10));
      }
    }
    let bkp = 0;
    for (const [id, fecha] of originalPorId) {
      const r = await c.query(`UPDATE "PEOPLE" SET "finalContratoOriginal" = $2::date WHERE "_id" = $1 AND "finalContratoOriginal" IS NULL`, [id, fecha]);
      bkp += r.rowCount;
    }

    // 3b. Con historial de extensiones: vigenciaAnterior de la primera extensión real.
    const conHist = (await c.query(
      `SELECT "_id", "extensionHistory" FROM "PEOPLE"
        WHERE "finalContratoOriginal" IS NULL AND "finalContrato" IS NOT NULL
          AND jsonb_typeof("extensionHistory") = 'array' AND jsonb_array_length("extensionHistory") > 0`)).rows;
    let hist = 0;
    for (const r of conHist) {
      const reales = r.extensionHistory
        .filter(e => e && e.vigenciaAnterior && !['CORRECCION', 'SINCRONIZACION'].includes(String(e.tipo || '').toUpperCase()))
        .sort((a, b) => String(a.fechaEjecucion || '').localeCompare(String(b.fechaEjecucion || '')));
      if (!reales.length) continue;
      await c.query(`UPDATE "PEOPLE" SET "finalContratoOriginal" = $2::date WHERE "_id" = $1`, [r._id, String(reales[0].vigenciaAnterior).slice(0, 10)]);
      hist++;
    }

    // 3c. El resto: su fecha final actual.
    const resto = await c.query(
      `UPDATE "PEOPLE" SET "finalContratoOriginal" = "finalContrato"::date
        WHERE "finalContratoOriginal" IS NULL AND "finalContrato" IS NOT NULL`);
    console.log(`finalContratoOriginal: ${bkp} desde backup · ${hist} desde extensionHistory · ${resto.rowCount} = fecha actual`);

    // 4. Sincronizar titulares desfasados.
    const desfasados = (await c.query(`
      WITH mx AS (
        SELECT b."contrato", MAX(b."finalContrato") AS maxb
          FROM "PEOPLE" b
         WHERE b."tipoUsuario" <> 'TITULAR' AND b."finalContrato" IS NOT NULL AND ${VIVO}
           AND COALESCE(b."contrato",'') <> '' AND b."contrato" NOT LIKE 'PRB-%'
         GROUP BY b."contrato"
      )
      SELECT DISTINCT ON (t."contrato") t."_id", t."contrato", t."finalContrato"::text AS fin, t."estado", t."extensionHistory", mx.maxb::text AS maxb
        FROM "PEOPLE" t JOIN mx ON mx."contrato" = t."contrato"
       WHERE t."tipoUsuario" = 'TITULAR' AND (t."finalContrato" IS NULL OR mx.maxb > t."finalContrato")
       ORDER BY t."contrato", (t."aprobacion" = 'Aprobado') DESC, t."_createdDate" DESC`)).rows;
    const hoy = new Date(); const hoy0 = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
    let reactivados = 0;
    for (const t of desfasados) {
      const nueva = t.maxb.slice(0, 10), anterior = t.fin ? t.fin.slice(0, 10) : null;
      const h = Array.isArray(t.extensionHistory) ? t.extensionHistory : [];
      h.push({ numero: h.length + 1, tipo: 'SINCRONIZACION', fechaEjecucion: new Date().toISOString(),
        vigenciaAnterior: anterior, vigenciaNueva: nueva,
        diasExtendidos: anterior ? Math.round((Date.parse(nueva) - Date.parse(anterior)) / 86400000) : null,
        motivo: 'Sincronización inicial con la fecha final del beneficiario más extendido (opción A, 2026-10-06)',
        ejecutadoPor: 'script:add-final-contrato-original' });
      const reactivar = String(t.estado || '').toUpperCase() === 'FINALIZADA' && Date.parse(nueva) + 2 * 86400000 > hoy0;
      if (reactivar) reactivados++;
      await c.query(
        `UPDATE "PEOPLE" SET "finalContrato" = $2::date, "extensionHistory" = $3::jsonb,
                ${reactivar ? `"estado" = 'ACTIVA', "estadoInactivo" = false,` : ''} "_updatedDate" = NOW()
          WHERE "_id" = $1`, [t._id, nueva, JSON.stringify(h)]);
    }
    console.log(`Titulares sincronizados: ${desfasados.length} (reactivados de FINALIZADA: ${reactivados})`);
    console.table(desfasados.slice(0, 10).map(t => ({ contrato: t.contrato, antes: t.fin && t.fin.slice(0, 10), ahora: t.maxb.slice(0, 10), estado: t.estado })));

    const chk = (await c.query(`SELECT COUNT(*) FILTER (WHERE "finalContratoOriginal" IS NULL AND "finalContrato" IS NOT NULL)::int faltan FROM "PEOPLE"`)).rows[0];
    console.log('Filas con finalContrato y sin original:', chk.faltan);
    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK. Use --apply.'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
