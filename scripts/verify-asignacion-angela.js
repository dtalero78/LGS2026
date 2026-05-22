/**
 * Sólo lectura. Verifica la asignación de Angela tras el apply.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const r1 = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM "PEOPLE" WHERE "gestorRecaudo" = 'angelapluas9@gmail.com'
    `);
    console.log(`PEOPLE.gestorRecaudo=angelapluas9@gmail.com: ${r1.rows[0].total} titulares`);

    const r2 = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM "PAGOS_TITULARES" WHERE "gestorRecaudo" = 'angelapluas9@gmail.com' AND "numCuota" = 0
    `);
    console.log(`PAGOS_TITULARES cuota#0 con Angela: ${r2.rows[0].total}`);

    // Muestra
    const r3 = await pool.query(`
      SELECT p."contrato", p."numeroId", p."primerNombre", p."primerApellido", p."plan",
             pt."valorPagado", pt."inscripcion", pt."saldo", pt."cuotasTotal",
             TO_CHAR(pt."fechaPago", 'YYYY-MM-DD') AS "fechaPago",
             pt."validadoPor"
      FROM "PEOPLE" p
      JOIN "PAGOS_TITULARES" pt ON pt."idPeople" = p."_id" AND pt."numCuota" = 0
      WHERE p."gestorRecaudo" = 'angelapluas9@gmail.com'
      ORDER BY p."_updatedDate" DESC LIMIT 5
    `);
    console.log('\nMuestra:');
    for (const row of r3.rows) {
      console.log(`  ${row.contrato} | ${row.primerNombre} ${row.primerApellido} | plan=${row.plan} | inscripcion=${row.inscripcion} | saldo=${row.saldo} | cuotas=${row.cuotasTotal} | fechaPago=${row.fechaPago} | validadoPor=${row.validadoPor}`);
    }
  } finally {
    await pool.end();
  }
})();
