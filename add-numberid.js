require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL?.replace('?sslmode=require','') || '';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });

async function run() {
  await pool.query(`
    ALTER TABLE "USUARIOS_ROLES"
    ADD COLUMN IF NOT EXISTS "numberid" VARCHAR
  `);
  console.log('✅ Columna numberid agregada a USUARIOS_ROLES');

  const check = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'USUARIOS_ROLES'
      AND column_name = 'numberid'
  `);
  console.log('Verificación:', check.rows.length > 0 ? '✅ Columna existe' : '❌ No encontrada');
  await pool.end();
}

run().catch(err => { console.error('❌ Error:', err.message); pool.end(); });
