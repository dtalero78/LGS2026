/**
 * Sólo lectura. Inspecciona fechaPago / fechaValidacion / _createdDate de
 * todos los PAGOS_TITULARES para detectar posibles corrimientos TZ (cuando
 * la fecha es 1 día mayor que la fecha local del _createdDate).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const rows = await pool.query(`
      SELECT
        pt."_id",
        pt."numCuota",
        pt."numeroRecibo",
        pt."fechaPago"::text       AS fecha_pago,
        pt."fechaVencimiento"::text AS fecha_venc,
        pt."fechaValidacion"::text  AS fecha_val,
        pt."_createdDate"           AS created_utc,
        (pt."_createdDate" AT TIME ZONE 'America/Bogota')::date::text AS created_local_co,
        pt."validado",
        p."contrato"
      FROM "PAGOS_TITULARES" pt
      LEFT JOIN "PEOPLE" p ON p."_id" = pt."idPeople"
      ORDER BY pt."_createdDate" DESC
      LIMIT 20
    `);
    console.log(`Últimos ${rows.rowCount} pagos:`);
    rows.rows.forEach(r => {
      const shifted = r.fecha_pago && r.created_local_co && r.fecha_pago !== r.created_local_co
        ? `   ⚠ shift: fechaPago=${r.fecha_pago} pero createdLocalCO=${r.created_local_co}`
        : '';
      console.log(
        `  ${r._id.slice(0,16)}  contrato=${r.contrato ?? '—'}  cuota=${r.numCuota}  ` +
        `fechaPago=${r.fecha_pago}  fechaVal=${r.fecha_val ?? '—'}  ` +
        `validado=${r.validado}${shifted}`
      );
    });
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
