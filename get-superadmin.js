require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function getSuperAdminPasswords() {
  try {
    const result = await pool.query(
      `SELECT "email", "password", "nombre"
       FROM "USUARIOS_ROLES"
       WHERE "rol" = $1 AND "activo" = true
       LIMIT 5`,
      ['SUPER_ADMIN']
    );

    console.log('🔑 Credenciales SUPER_ADMIN:\n');
    result.rows.forEach(user => {
      const isHashed = user.password.startsWith('$2');
      console.log('Email:', user.email);
      console.log('Nombre:', user.nombre);
      console.log('Password type:', isHashed ? 'bcrypt hash' : 'plain text');
      if (!isHashed) {
        console.log('Password:', user.password);
      }
      console.log('---');
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

getSuperAdminPasswords();
