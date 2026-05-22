/**
 * Sólo lectura. Inspecciona schemas de FINANCIEROS y PAGOS_TITULARES.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const t of ['FINANCIEROS', 'PAGOS_TITULARES']) {
      const r = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1 ORDER BY ordinal_position
      `, [t]);
      console.log(`\n=== ${t} (${r.rowCount} columnas) ===`);
      for (const c of r.rows) {
        console.log(`  ${c.column_name.padEnd(25)} ${c.data_type.padEnd(28)} nullable=${c.is_nullable} default=${c.column_default || ''}`);
      }
    }

    // Ejemplo de cuota #0 existente, para ver el formato real
    const sample = await pool.query(`
      SELECT * FROM "PAGOS_TITULARES" WHERE "numCuota" = 0 ORDER BY "_createdDate" DESC LIMIT 1
    `);
    if (sample.rowCount > 0) {
      console.log('\n=== Ejemplo cuota #0 más reciente ===');
      console.log(JSON.stringify(sample.rows[0], null, 2));
    }
  } finally {
    await pool.end();
  }
})();
