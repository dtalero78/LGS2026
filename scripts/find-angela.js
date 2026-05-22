/**
 * Sólo lectura. Busca a Angela Maritza Pluas Llerena en USUARIOS_ROLES.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // 1) Schema USUARIOS_ROLES
    const schema = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'USUARIOS_ROLES' ORDER BY ordinal_position
    `);
    console.log('=== USUARIOS_ROLES schema ===');
    for (const c of schema.rows) console.log(`  ${c.column_name} (${c.data_type})`);

    // 2) Búsqueda por email/usuario que contenga "angela", "pluas" o "llerena"
    console.log('\n=== Candidatos ===');
    const r = await pool.query(`
      SELECT *
      FROM "USUARIOS_ROLES"
      WHERE LOWER(COALESCE("email", '')) LIKE '%angela%'
         OR LOWER(COALESCE("email", '')) LIKE '%pluas%'
         OR LOWER(COALESCE("email", '')) LIKE '%llerena%'
         OR LOWER(COALESCE("nombre", '')) LIKE '%angela%'
         OR LOWER(COALESCE("nombre", '')) LIKE '%pluas%'
         OR LOWER(COALESCE("nombre", '')) LIKE '%llerena%'
      ORDER BY "_updatedDate" DESC NULLS LAST
      LIMIT 20
    `);
    console.log(`Encontrados ${r.rowCount}\n`);
    for (const u of r.rows) console.log(JSON.stringify(u, null, 2));
  } finally {
    await pool.end();
  }
})();
