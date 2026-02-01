/**
 * Playwright test for PUT /api/postgres/students/[id]/update
 * Uses authenticated browser session
 */

const { chromium } = require('playwright');
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
  console.log('🧪 Testing Student Update Endpoint (Playwright)\n');
  console.log('='.repeat(60));

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

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to app and login
    console.log('\n2️⃣  Logging in...');
    await page.goto(`${BASE_URL}/login`);

    // Check if already logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      console.log('✅ Already logged in');
    } else {
      console.log('⏳ Waiting for manual login...');
      await page.waitForURL(url => !url.includes('/login'), { timeout: 60000 });
      console.log('✅ Login successful');
    }

    // Test 1: Update student comentarios
    console.log('\n3️⃣  Test 1: Update student comentarios');
    const newComentarios = `[TEST] Updated at ${new Date().toISOString()}`;

    const updateResponse = await page.evaluate(async ({ id, comentarios }) => {
      const response = await fetch(`/api/postgres/students/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comentarios }),
      });
      return response.json();
    }, { id: testStudent._id, comentarios: newComentarios });

    if (updateResponse.success) {
      console.log('✅ Update successful');
      console.log(`   Updated fields: ${updateResponse.updated}`);
      console.log(`   New comentarios: ${updateResponse.student.comentarios?.substring(0, 70)}...`);
    } else {
      console.error('❌ Update failed:', updateResponse.error);
    }

    // Test 2: Verify in database
    console.log('\n4️⃣  Test 2: Verify update in database');
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
    console.log('\n5️⃣  Test 3: Update nivel and step');
    const originalNivel = testStudent.nivel;
    const originalStep = testStudent.step;

    const updateLevelResponse = await page.evaluate(async ({ id }) => {
      const response = await fetch(`/api/postgres/students/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nivel: 'BN2',
          step: 'Step 10'
        }),
      });
      return response.json();
    }, { id: testStudent._id });

    if (updateLevelResponse.success) {
      console.log('✅ Level update successful');
      console.log(`   Old nivel: ${originalNivel} → New nivel: ${updateLevelResponse.student.nivel}`);
      console.log(`   Old step: ${originalStep} → New step: ${updateLevelResponse.student.step}`);
    } else {
      console.error('❌ Level update failed:', updateLevelResponse.error);
    }

    // Test 4: Restore original values
    console.log('\n6️⃣  Test 4: Restore original values');
    const restoreResponse = await page.evaluate(async ({ id, nivel, step, comentarios }) => {
      const response = await fetch(`/api/postgres/students/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nivel, step, comentarios }),
      });
      return response.json();
    }, {
      id: testStudent._id,
      nivel: originalNivel,
      step: originalStep,
      comentarios: testStudent.comentarios || ''
    });

    if (restoreResponse.success) {
      console.log('✅ Values restored');
      console.log(`   Nivel: ${restoreResponse.student.nivel}`);
      console.log(`   Step: ${restoreResponse.student.step}`);
    } else {
      console.error('❌ Restore failed:', restoreResponse.error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!\n');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
    await pool.end();
  }
}

// Run tests
testUpdateStudent().catch(console.error);
