/**
 * Asigna estado 'PENDIENTE' a las personas que quedaron con PEOPLE.estado NULL
 * por haber sido creadas SIN aprobar (Crear Contrato y "Agregar beneficiario"
 * no asignaban estado hasta el fix del 2026-10-08 → la ficha mostraba "Null").
 *
 * Solo toca: estado NULL/vacío + aprobacion NULL o 'Pendiente' + no inactivos.
 * Los NULL con otra aprobación (casos raros) se listan y NO se tocan.
 * Dry-run por defecto; --apply escribe en una transacción.
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');

const WHERE = `NULLIF(TRIM(COALESCE("estado",'')),'') IS NULL
  AND (NULLIF(TRIM(COALESCE("aprobacion",'')),'') IS NULL OR "aprobacion" = 'Pendiente')
  AND "estadoInactivo" IS NOT TRUE`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const resumen = await c.query(`SELECT "tipoUsuario", COALESCE("aprobacion",'(vacía)') aprobacion, COUNT(*)::int n,
        MIN("_createdDate")::date desde, MAX("_createdDate")::date hasta
       FROM "PEOPLE" WHERE ${WHERE} GROUP BY 1,2 ORDER BY 1,2`);
    console.log('Se pasarán a PENDIENTE:'); console.table(resumen.rows);
    const otros = await c.query(`SELECT COALESCE("aprobacion",'(vacía)') aprobacion, "estadoInactivo", COUNT(*)::int n
       FROM "PEOPLE" WHERE NULLIF(TRIM(COALESCE("estado",'')),'') IS NULL AND NOT (${WHERE}) GROUP BY 1,2 ORDER BY 3 DESC`);
    console.log('Con estado NULL que NO se tocan (otra aprobación o inactivos):'); console.table(otros.rows);
    const upd = await c.query(`UPDATE "PEOPLE" SET "estado" = 'PENDIENTE', "_updatedDate" = NOW() WHERE ${WHERE}`);
    if (APPLY) { await c.query('COMMIT'); console.log(`APLICADO: ${upd.rowCount} personas → PENDIENTE`); }
    else { await c.query('ROLLBACK'); console.log(`DRY-RUN: ${upd.rowCount} personas pasarían a PENDIENTE. Use --apply.`); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => null);
    console.error('ERROR (rollback):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
