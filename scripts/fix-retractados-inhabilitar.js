// Fix (autorizado 2026-10-06): los contratos RETRACTADO (el cliente se retractó en el
// plazo legal) deben dejar inhabilitadas a todas sus personas. Antes el estado
// Retractado no inactivaba a nadie. Aplica a los existentes la misma regla de
// src/lib/retractado.ts:
//   - PEOPLE (titular + beneficiarios): estadoInactivo=true, estado='RETRACTADO'
//   - ACADEMICA de esos beneficiarios (por usuarioId o contrato): estadoInactivo=true
//   - USUARIOS_ROLES ESTUDIANTE de esos beneficiarios: activo=false, salvo que el
//     correo pertenezca a un beneficiario VIVO de otro contrato (re-matrícula).
// Dry-run por defecto; --apply para escribir. Todo en una transacción.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    const contratos = (await c.query(
      `SELECT DISTINCT "contrato" FROM "PEOPLE"
        WHERE "tipoUsuario" = 'TITULAR' AND "aprobacion" = 'Retractado'
          AND COALESCE("contrato",'') <> '' AND "contrato" NOT LIKE 'PRB-%'
        ORDER BY 1`)).rows.map(r => r.contrato);
    console.log(`Contratos retractados: ${contratos.length}`);
    const resumen = [];
    for (const contrato of contratos) {
      const people = await c.query(
        `UPDATE "PEOPLE" SET "estadoInactivo" = true, "estado" = 'RETRACTADO', "_updatedDate" = NOW()
          WHERE "contrato" = $1 AND ("estadoInactivo" IS NOT TRUE OR COALESCE("estado",'') <> 'RETRACTADO')
          RETURNING "_id", "tipoUsuario"`, [contrato]);
      const benefIds = (await c.query(
        `SELECT "_id" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" <> 'TITULAR'`, [contrato])).rows.map(r => r._id);
      const fichas = await c.query(
        `UPDATE "ACADEMICA" SET "estadoInactivo" = true, "_updatedDate" = NOW()
          WHERE ("usuarioId" = ANY($1::text[]) OR "contrato" = $2) AND "estadoInactivo" IS NOT TRUE`, [benefIds, contrato]);
      const logins = await c.query(
        `UPDATE "USUARIOS_ROLES" u SET "activo" = false
          WHERE u."activo" IS TRUE AND UPPER(COALESCE(u."rol",'')) = 'ESTUDIANTE'
            AND LOWER(TRIM(u."email")) IN (SELECT LOWER(TRIM(p."email")) FROM "PEOPLE" p WHERE p."_id" = ANY($1::text[]) AND COALESCE(p."email",'') <> '')
            AND NOT EXISTS (
                  SELECT 1 FROM "PEOPLE" o
                   WHERE LOWER(TRIM(o."email")) = LOWER(TRIM(u."email"))
                     AND o."contrato" IS DISTINCT FROM $2 AND o."tipoUsuario" <> 'TITULAR'
                     AND UPPER(COALESCE(o."estado",'')) NOT IN ('FINALIZADA','ANULADO','RETRACTADO')
                     AND UPPER(COALESCE(o."aprobacion",'')) NOT IN ('CONTRATO NULO','DEVUELTO','RECHAZADO','RETRACTADO')
                     AND (o."estadoInactivo" IS NOT TRUE OR o."fechaOnHold" IS NOT NULL))
          RETURNING u."email"`, [benefIds, contrato]);
      resumen.push({ contrato, personas: people.rowCount, fichas: fichas.rowCount, accesos: logins.rowCount });
    }
    console.table(resumen);
    const tot = resumen.reduce((a, r) => ({ p: a.p + r.personas, f: a.f + r.fichas, l: a.l + r.accesos }), { p: 0, f: 0, l: 0 });
    console.log(`Total: ${tot.p} personas, ${tot.f} fichas académicas y ${tot.l} accesos inhabilitados`);
    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK. Use --apply.'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
