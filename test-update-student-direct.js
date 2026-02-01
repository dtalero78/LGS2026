/**
 * Test script for PUT /api/postgres/students/[id]/update
 * Gets student directly from database
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'http://localhost:3001';

async function testUpdateStudent() {
  console.log('🧪 Testing Student Update Endpoint\n');
  console.log('=' .repeat(60));

  // Get a test student from database
  console.log('\n1️⃣  Getting test student from database...');
  const result = await pool.query(
    `SELECT "_id", "primerNombre", "primerApellido", "nivel", "step", "comentarios", "_updatedDate"
     FROM "PEOPLE"
     WHERE "tipoUsuario" = 'BENEFICIARIO'
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    console.error('❌ No students found in database');
    await pool.end();
    return;
  }

  const testStudent = result.rows[0];
  console.log(`✅ Found test student: ${testStudent.primerNombre} ${testStudent.primerApellido}`);
  console.log(`   ID: ${testStudent._id}`);
  console.log(`   Current nivel: ${testStudent.nivel}`);
  console.log(`   Current step: ${testStudent.step}`);

  // Test 1: Update student comentarios
  console.log('\n2️⃣  Test 1: Update student comentarios');
  const updateResponse = await fetch(
    `${BASE_URL}/api/postgres/students/${testStudent._id}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=test' // Mock auth for testing
      },
      body: JSON.stringify({
        comentarios: `[TEST] Updated at ${new Date().toISOString()}`
      }),
    }
  );

  const updateData = await updateResponse.json();

  if (updateData.success) {
    console.log('✅ Update successful');
    console.log(`   Updated fields: ${updateData.updated}`);
    console.log(`   New comentarios: ${updateData.student.comentarios?.substring(0, 70)}...`);
  } else {
    console.error('❌ Update failed:', updateData.error);
  }

  // Test 2: Verify in database
  console.log('\n3️⃣  Test 2: Verify update in database');
  const verifyResult = await pool.query(
    `SELECT "comentarios", "_updatedDate"
     FROM "PEOPLE"
     WHERE "_id" = $1`,
    [testStudent._id]
  );

  if (verifyResult.rows.length > 0) {
    const updated = verifyResult.rows[0];
    const originalDate = new Date(testStudent._updatedDate);
    const newDate = new Date(updated._updatedDate);

    console.log('✅ Database verification successful');
    console.log(`   Comentarios updated: ${updated.comentarios?.substring(0, 70)}...`);
    console.log(`   _updatedDate changed: ${newDate > originalDate ? 'YES ✅' : 'NO ❌'}`);
  }

  // Test 3: Update nivel and step
  console.log('\n4️⃣  Test 3: Update nivel and step');
  const originalNivel = testStudent.nivel;
  const originalStep = testStudent.step;

  const updateLevelResponse = await fetch(
    `${BASE_URL}/api/postgres/students/${testStudent._id}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nivel: 'BN2',
        step: 'Step 10'
      }),
    }
  );

  const updateLevelData = await updateLevelResponse.json();

  if (updateLevelData.success) {
    console.log('✅ Level update successful');
    console.log(`   Old nivel: ${originalNivel} → New nivel: ${updateLevelData.student.nivel}`);
    console.log(`   Old step: ${originalStep} → New step: ${updateLevelData.student.step}`);
  } else {
    console.error('❌ Level update failed:', updateLevelData.error);
  }

  // Test 4: Restore original values
  console.log('\n5️⃣  Test 4: Restore original values');
  const restoreResponse = await fetch(
    `${BASE_URL}/api/postgres/students/${testStudent._id}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nivel: originalNivel,
        step: originalStep,
        comentarios: testStudent.comentarios || ''
      }),
    }
  );

  const restoreData = await restoreResponse.json();

  if (restoreData.success) {
    console.log('✅ Values restored');
    console.log(`   Nivel: ${restoreData.student.nivel}`);
    console.log(`   Step: ${restoreData.student.step}`);
  } else {
    console.error('❌ Restore failed:', restoreData.error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');

  await pool.end();
}

// Run tests
testUpdateStudent().catch(async (error) => {
  console.error('❌ Test error:', error);
  await pool.end();
});
