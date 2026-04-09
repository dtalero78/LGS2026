require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL?.replace('?sslmode=require','') || '';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });

async function run() {
  const check = await pool.query(`
    SELECT COUNT(*) as total FROM "ACADEMICA_BOOKINGS"
    WHERE "celular" = '56966880123'
  `);
  console.log('Registros a actualizar:', check.rows[0].total);

  const r = await pool.query(`
    UPDATE "ACADEMICA_BOOKINGS"
    SET "idEstudiante" = '74342aa5-307b-412a-88b5-3d308e8fe9c8'
    WHERE "celular" = '56966880123'
  `);
  console.log('✅ Registros actualizados:', r.rowCount);
  await pool.end();
}

run().catch(err => { console.error('❌ Error:', err.message); pool.end(); });
