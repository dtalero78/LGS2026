process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const { rows } = await pool.query(`SELECT "_id","rol" FROM "ROL_PERMISOS" ORDER BY "rol"`);
    console.log('_id\t\t\t\trol');
    for (const r of rows) console.log(`${String(r._id).padEnd(38)}${r.rol}`);
  } finally { await pool.end(); }
})();
