/**
 * Papelera del Libro de Producción (2026-11-26).
 *
 *   node scripts/add-papelera-libro.js            → dry-run: muestra lo que haría y cuántos
 *                                                   contratos entrarían a la Papelera hoy
 *   node scripts/add-papelera-libro.js --apply    → aplica
 *
 * 1) PEOPLE."papeleraEn" (TIMESTAMPTZ) y PEOPLE."papeleraRestauradaEn" (TIMESTAMPTZ) +
 *    índice parcial sobre los que están en la Papelera.
 * 2) Permisos por pestaña: da APROBACION.LIBRO_PRODUCCION.LIBRO / .POR_RESOLVER /
 *    .RECHAZADOS / .CANJE a los roles que hoy tienen .VER (nadie pierde lo que ya veía).
 *    .PAPELERA y .PAPELERA_BORRAR quedan sin asignar.
 * 3) Conteo: contratos que el cron enviaría a la Papelera en su primera ejecución
 *    (misma regla que src/services/libro-papelera.service.ts). Solo informa.
 *
 * Idempotente. Debe correr ANTES de desplegar el código que lee las columnas.
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const VER = 'APROBACION.LIBRO_PRODUCCION.VER';
const NUEVOS = ['APROBACION.LIBRO_PRODUCCION.LIBRO', 'APROBACION.LIBRO_PRODUCCION.POR_RESOLVER', 'APROBACION.LIBRO_PRODUCCION.RECHAZADOS', 'APROBACION.LIBRO_PRODUCCION.CANJE'];

const norm = (c) => `UPPER(REGEXP_REPLACE(COALESCE(${c},''), '[.[:space:]_-]', '', 'g'))`;
const APROB = `LOWER(TRIM(COALESCE(p."aprobacion",'')))`;
const COMPLETO = `(COALESCE(p."hashConsentimiento",'') <> ''
  AND (CASE WHEN jsonb_typeof(p."documentacion") = 'array' THEN jsonb_array_length(p."documentacion") ELSE 0 END) > 0
  AND p."reciboInscripcion" IS NOT NULL AND COALESCE(p."driveFileId",'') <> '')`;
const POR_RESOLVER = `(UPPER(COALESCE(p."tipoContrato",'')) <> 'CANJE' AND ${APROB} !~ '^(aprobad|finaliz)' AND ${APROB} NOT IN ('pendiente comercial','retractado','rechazado')
  AND NOT (${APROB} IN ('','pendiente') AND ${COMPLETO}))`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(APPLY ? '=== APLICANDO ===' : '=== DRY-RUN (use --apply para escribir) ===');

  // 1) Columnas
  const cols = (await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'PEOPLE' AND column_name IN ('papeleraEn','papeleraRestauradaEn')`)).rows.map(r => r.column_name);
  console.log(`Columnas existentes: ${cols.join(', ') || '(ninguna)'}`);
  if (APPLY) {
    await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "papeleraEn" TIMESTAMPTZ`);
    await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "papeleraRestauradaEn" TIMESTAMPTZ`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_people_papelera ON "PEOPLE" ("papeleraEn") WHERE "papeleraEn" IS NOT NULL`);
    console.log('✅ Columnas e índice listos');
  }

  // 2) Permisos
  const roles = (await c.query(`SELECT "rol", "permisos" FROM "ROL_PERMISOS"`)).rows
    .filter(r => Array.isArray(r.permisos) && r.permisos.includes(VER));
  if (APPLY) await c.query('BEGIN');
  for (const r of roles) {
    const faltan = NUEVOS.filter(p => !r.permisos.includes(p));
    console.log(`Rol ${r.rol}: ${faltan.length ? 'agrega ' + faltan.join(', ') : 'ya los tiene'}`);
    if (APPLY && faltan.length) {
      await c.query(
        `UPDATE "ROL_PERMISOS" SET "permisos" = COALESCE("permisos"::jsonb,'[]'::jsonb) || $2::jsonb,
                "_updatedDate" = NOW() WHERE "rol" = $1`, [r.rol, JSON.stringify(faltan)]);
    }
  }
  if (APPLY) await c.query('COMMIT');

  // 3) Conteo de la primera ejecución
  const tieneRest = cols.includes('papeleraRestauradaEn') || APPLY;
  const desde = tieneRest ? `COALESCE(p."papeleraRestauradaEn", p."fechaCreacion", p."_createdDate")` : `COALESCE(p."fechaCreacion", p."_createdDate")`;
  const fuera = cols.includes('papeleraEn') || APPLY ? `AND p."papeleraEn" IS NULL` : '';
  const cand = (await c.query(`
    SELECT DISTINCT ON (p."contrato") p."contrato", p."aprobacion",
           (COALESCE(p."hashConsentimiento",'') <> '') AS firmado
      FROM "PEOPLE" p
     WHERE p."tipoUsuario" = 'TITULAR' AND COALESCE(p."contrato",'') <> '' AND p."contrato" NOT LIKE 'PRB-%'
       ${fuera} AND ${POR_RESOLVER}
       AND ${desde} <= NOW() - INTERVAL '15 days'
       AND NOT EXISTS (SELECT 1 FROM "PAGOS_TITULARES" pt JOIN "PEOPLE" x ON x."_id" = pt."idPeople"
                        WHERE x."contrato" = p."contrato" AND pt."validado" IS TRUE)
     ORDER BY p."contrato", (COALESCE(p."hashConsentimiento",'') <> '') DESC, (p."aprobacion" IS NOT NULL) DESC, p."_createdDate" ASC`)).rows;
  let entran = 0; const porEstado = {};
  for (const t of cand) {
    const n = (await c.query(`
      WITH propios AS (
        SELECT DISTINCT ${norm('p."numeroId"')} AS nid FROM "PEOPLE" p
         WHERE p."contrato" = $1 AND COALESCE(p."numeroId",'') <> ''
           AND NOT EXISTS (SELECT 1 FROM "PEOPLE" o WHERE ${norm('o."numeroId"')} = ${norm('p."numeroId"')} AND COALESCE(o."contrato",'') <> $1))
      SELECT COUNT(*)::int AS n FROM "ACADEMICA_BOOKINGS" b
        JOIN "ACADEMICA" a ON a."_id" = COALESCE(b."studentId", b."idEstudiante")
       WHERE ${norm('a."numeroId"')} IN (SELECT nid FROM propios)`, [t.contrato])).rows[0].n;
    if (n > 0) continue;
    entran++;
    const k = (t.aprobacion && !/^pendiente$/i.test(t.aprobacion.trim()) ? t.aprobacion : 'Sin estado') + (t.firmado ? ' · firmado' : ' · sin firmar');
    porEstado[k] = (porEstado[k] || 0) + 1;
  }
  console.log(`\nPrimera ejecución del cron: ${entran} contrato(s) entrarían a la Papelera (de ${cand.length} candidatos sin pagos validados; el resto tiene clases).`);
  Object.entries(porEstado).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
