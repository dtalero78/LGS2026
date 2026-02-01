/**
 * Test Login con PostgreSQL
 * Run: node test-login-postgres.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function testLogin(email, password) {
  console.log('🔍 Testing login for:', email);

  try {
    // 1. Buscar usuario
    const result = await pool.query(
      `SELECT "_id", "email", "password", "nombre", "rol", "activo"
       FROM "USUARIOS_ROLES"
       WHERE "email" = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      console.log('❌ Usuario no encontrado');
      return false;
    }

    const user = result.rows[0];
    console.log('✅ Usuario encontrado:', {
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      activo: user.activo,
      passwordType: user.password.startsWith('$2') ? 'bcrypt' : 'plain text'
    });

    // 2. Verificar que está activo
    if (!user.activo) {
      console.log('❌ Usuario inactivo');
      return false;
    }

    // 3. Verificar contraseña
    let isPasswordValid = false;

    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      console.log('🔐 Verificando con bcrypt...');
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      console.log('⚠️  Verificando con plain text...');
      isPasswordValid = password === user.password;
    }

    if (isPasswordValid) {
      console.log('✅ Login exitoso!');
      console.log('📋 Datos de sesión:', {
        id: user._id,
        email: user.email,
        name: user.nombre,
        role: user.rol
      });
      return true;
    } else {
      console.log('❌ Contraseña incorrecta');
      console.log('   Expected:', user.password);
      console.log('   Received:', password);
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

// Test con el usuario ADVISOR
testLogin('academicoconsultalgs@letsgospeak.cl', 'academicA');
