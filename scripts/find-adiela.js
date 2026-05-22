/**
 * Sólo lectura. Busca a Adiela Londoño Cuellar en USUARIOS_ROLES.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const ID = 'dcce6de6-a29b-4073-8252-18524024569b';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const r = await pool.query(`
      SELECT * FROM "USUARIOS_ROLES" WHERE "_id" = $1
    `, [ID]);
    console.log(`Match por _id="${ID}":`);
    if (r.rowCount === 0) {
      console.log('  NO ENCONTRADO');
    } else {
      console.log(JSON.stringify(r.rows[0], null, 2));
    }

    // Fallback: buscar por nombre
    const r2 = await pool.query(`
      SELECT "_id", "email", "nombre", "apellido", "rol", "activo", "plataforma"
      FROM "USUARIOS_ROLES"
      WHERE LOWER(COALESCE("nombre", '')) LIKE '%adiela%'
         OR LOWER(COALESCE("apellido", '')) LIKE '%londo%cuellar%'
         OR LOWER(COALESCE("email", '')) LIKE '%adiela%'
      ORDER BY "_updatedDate" DESC NULLS LAST
    `);
    console.log(`\nMatch por nombre Adiela/Londoño: ${r2.rowCount}`);
    for (const u of r2.rows) console.log(`  _id=${u._id} | ${u.nombre || ''} ${u.apellido || ''} | email=${u.email} | rol=${u.rol} | activo=${u.activo} | plataforma=${u.plataforma || '(null)'}`);
  } finally {
    await pool.end();
  }
})();
