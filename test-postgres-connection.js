/**
 * Test PostgreSQL Connection from Next.js
 * Run: node test-postgres-connection.js
 */

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

async function testConnection() {
  console.log('🔌 Testing PostgreSQL connection...\n');

  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic Connection');
    const result = await pool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Connected successfully');
    console.log('   Time:', result.rows[0].now);
    console.log('   Version:', result.rows[0].version.substring(0, 60) + '...\n');

    // Test 2: Check tables exist
    console.log('Test 2: Check Tables');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`✅ Found ${tables.rowCount} tables:`);
    tables.rows.forEach(t => console.log('   -', t.table_name));
    console.log('');

    // Test 3: Count records in key tables
    console.log('Test 3: Record Counts');
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM "NIVELES") as niveles,
        (SELECT COUNT(*) FROM "ROL_PERMISOS") as rol_permisos,
        (SELECT COUNT(*) FROM "USUARIOS_ROLES") as usuarios_roles,
        (SELECT COUNT(*) FROM "PEOPLE") as people,
        (SELECT COUNT(*) FROM "ACADEMICA") as academica,
        (SELECT COUNT(*) FROM "CALENDARIO") as calendario,
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS") as academica_bookings
    `);
    console.log('✅ Records per table:');
    const c = counts.rows[0];
    console.log(`   NIVELES: ${c.niveles}`);
    console.log(`   ROL_PERMISOS: ${c.rol_permisos}`);
    console.log(`   USUARIOS_ROLES: ${c.usuarios_roles}`);
    console.log(`   PEOPLE: ${c.people}`);
    console.log(`   ACADEMICA: ${c.academica}`);
    console.log(`   CALENDARIO: ${c.calendario}`);
    console.log(`   ACADEMICA_BOOKINGS: ${c.academica_bookings}\n`);

    // Test 4: Sample query - Get one user
    console.log('Test 4: Sample Query - Get Admin User');
    const user = await pool.query(`
      SELECT "email", "rol", "activo", "_createdDate"
      FROM "USUARIOS_ROLES"
      WHERE "rol" = 'ADMIN'
      LIMIT 1
    `);
    if (user.rowCount > 0) {
      console.log('✅ Sample user found:');
      console.log('   Email:', user.rows[0].email);
      console.log('   Rol:', user.rows[0].rol);
      console.log('   Activo:', user.rows[0].activo);
      console.log('   Created:', user.rows[0]._createdDate);
    } else {
      console.log('⚠️  No ADMIN user found');
    }
    console.log('');

    // Test 5: JSONB field test
    console.log('Test 5: JSONB Fields - ROL_PERMISOS');
    const permisos = await pool.query(`
      SELECT "rol", "permisos", "descripcion"
      FROM "ROL_PERMISOS"
      WHERE "rol" = 'ADMIN'
      LIMIT 1
    `);
    if (permisos.rowCount > 0) {
      const p = permisos.rows[0];
      console.log('✅ ADMIN role found:');
      console.log('   Rol:', p.rol);
      console.log('   Descripcion:', p.descripcion);
      console.log('   Permisos type:', typeof p.permisos);
      console.log('   Permisos count:', Array.isArray(p.permisos) ? p.permisos.length : 'N/A');
      if (Array.isArray(p.permisos) && p.permisos.length > 0) {
        console.log('   Sample permissions:', p.permisos.slice(0, 3).join(', '));
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL TESTS PASSED - PostgreSQL is ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
