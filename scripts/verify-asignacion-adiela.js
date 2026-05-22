/**
 * Sólo lectura. Verifica la asignación de Adiela tras el apply.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const GESTOR = 'dcce6de6-a29b-4073-8252-18524024569b';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const r1 = await pool.query(`SELECT COUNT(*)::int AS t FROM "PEOPLE" WHERE "gestorRecaudo" = $1`, [GESTOR]);
    console.log(`PEOPLE.gestorRecaudo=${GESTOR}: ${r1.rows[0].t} titulares`);

    const r2 = await pool.query(`SELECT COUNT(*)::int AS t FROM "PAGOS_TITULARES" WHERE "gestorRecaudo" = $1 AND "numCuota" = 0`, [GESTOR]);
    console.log(`PAGOS_TITULARES cuota#0 con Adiela: ${r2.rows[0].t}`);

    const r3 = await pool.query(`
      SELECT p."contrato", p."numeroId", p."primerNombre", p."primerApellido", p."plan",
             pt."inscripcion", pt."saldo", pt."cuotasTotal", pt."vlrTotalProg",
             TO_CHAR(pt."fechaPago", 'YYYY-MM-DD') AS "fechaPago",
             pt."validadoPor"
      FROM "PEOPLE" p
      JOIN "PAGOS_TITULARES" pt ON pt."idPeople" = p."_id" AND pt."numCuota" = 0
      WHERE p."gestorRecaudo" = $1
      ORDER BY p."_updatedDate" DESC LIMIT 5
    `, [GESTOR]);
    console.log('\nMuestra:');
    for (const row of r3.rows) {
      console.log(`  ${row.contrato} | ${row.primerNombre} ${row.primerApellido} | plan=${row.plan} | inscripcion=${row.inscripcion} | vlrTotalProg=${row.vlrTotalProg} | saldo=${row.saldo} | cuotas=${row.cuotasTotal} | fechaPago=${row.fechaPago} | validadoPor=${row.validadoPor}`);
    }
  } finally {
    await pool.end();
  }
})();
