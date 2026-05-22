/**
 * Sólo lectura. Determina si gestorRecaudo se guarda como _id o email.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const t of ['PEOPLE', 'PAGOS_TITULARES']) {
      const r = await pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE "gestorRecaudo" LIKE '%@%')::int AS con_arroba,
               COUNT(*) FILTER (WHERE "gestorRecaudo" IS NOT NULL AND "gestorRecaudo" NOT LIKE '%@%')::int AS sin_arroba
        FROM "${t}" WHERE "gestorRecaudo" IS NOT NULL
      `);
      console.log(`${t}: ${JSON.stringify(r.rows[0])}`);

      const sample = await pool.query(`
        SELECT DISTINCT "gestorRecaudo" FROM "${t}"
        WHERE "gestorRecaudo" IS NOT NULL
        ORDER BY 1 LIMIT 20
      `);
      console.log(`  Sample (${sample.rowCount}):`);
      for (const s of sample.rows) console.log(`    ${s.gestorRecaudo}`);
      console.log();
    }
  } finally {
    await pool.end();
  }
})();
