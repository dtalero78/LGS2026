require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL?.replace('?sslmode=require','') || '';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });

async function run() {
  const r = await pool.query(`
    UPDATE "CALENDARIO"
    SET "tipo" = "evento"
    WHERE "evento" IS NOT NULL
      AND ("tipo" IS NULL OR "tipo" != "evento")
  `);
  console.log('Registros actualizados:', r.rowCount);

  const check = await pool.query(`
    SELECT COUNT(*) AS pendientes
    FROM "CALENDARIO"
    WHERE "evento" IS NOT NULL
      AND ("tipo" IS NULL OR "tipo" != "evento")
  `);
  console.log('Pendientes tras update:', check.rows[0].pendientes);
}
run().catch(e => console.error('DB ERROR:', e.message)).finally(() => pool.end());
