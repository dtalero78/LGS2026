/**
 * Distingue "SIN APROBAR" (contrato nunca aprobado) de "PENDIENTE" (puesto en
 * Pendiente a propósito, p. ej. un aprobado devuelto). Desde el 2026-10-08 las
 * personas nuevas nacen 'SIN APROBAR'; este script corrige las existentes.
 *
 * Pasa a 'SIN APROBAR' (activos, con estado NULL/vacío o 'PENDIENTE'):
 *  - TITULAR cuya aprobacion está vacía (nunca se decidió);
 *  - BENEFICIARIO con aprobacion vacía, o 'Pendiente' (valor por defecto al
 *    agregarlo desde la ficha) sin una devolución Aprobado→Pendiente registrada
 *    en APROBACION_AUDIT.
 * Se mantienen en 'PENDIENTE' los titulares en 'Pendiente' y los beneficiarios
 * devueltos a Pendiente con registro.
 * Dry-run por defecto; --apply escribe en una transacción.
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');

const VACIA = c => `NULLIF(TRIM(COALESCE(${c},'')),'') IS NULL`;
const WHERE = `p."estadoInactivo" IS NOT TRUE
  AND (${VACIA('p."estado"')} OR p."estado" = 'PENDIENTE')
  AND (
    (p."tipoUsuario" = 'TITULAR' AND ${VACIA('p."aprobacion"')})
    OR (p."tipoUsuario" = 'BENEFICIARIO' AND (
          ${VACIA('p."aprobacion"')}
          OR (p."aprobacion" = 'Pendiente' AND NOT EXISTS (
                SELECT 1 FROM "APROBACION_AUDIT" a WHERE a."personId" = p."_id" AND a."estadoAnterior" = 'Aprobado'))
    ))
  )`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query(`SELECT p."tipoUsuario", COALESCE(p."estado",'(vacío)') estado, COALESCE(p."aprobacion",'(vacía)') aprobacion, COUNT(*)::int n
       FROM "PEOPLE" p WHERE ${WHERE} GROUP BY 1,2,3 ORDER BY 1,2,3`);
    console.log('Pasarán a SIN APROBAR:'); console.table(r.rows);
    const quedan = await c.query(`SELECT p."tipoUsuario", COALESCE(p."aprobacion",'(vacía)') aprobacion, COUNT(*)::int n
       FROM "PEOPLE" p WHERE p."estado" = 'PENDIENTE' AND p."estadoInactivo" IS NOT TRUE AND NOT (${WHERE}) GROUP BY 1,2`);
    console.log('Se quedan en PENDIENTE (puestos en Pendiente a propósito):'); console.table(quedan.rows);
    const upd = await c.query(`UPDATE "PEOPLE" p SET "estado" = 'SIN APROBAR', "_updatedDate" = NOW() WHERE ${WHERE}`);
    if (APPLY) { await c.query('COMMIT'); console.log(`APLICADO: ${upd.rowCount} personas → SIN APROBAR`); }
    else { await c.query('ROLLBACK'); console.log(`DRY-RUN: ${upd.rowCount} personas pasarían a SIN APROBAR. Use --apply.`); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => null);
    console.error('ERROR (rollback):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
