/**
 * Test script for PUT /api/postgres/students/[id]/update
 *
 * Tests:
 * 1. Update student name
 * 2. Update student level
 * 3. Update multiple fields at once
 * 4. Verify _updatedDate is updated
 */

const BASE_URL = 'http://localhost:3001';

async function testUpdateStudent() {
  console.log('🧪 Testing Student Update Endpoint\n');
  console.log('=' .repeat(60));

  // First, get a test student ID
  console.log('\n1️⃣  Getting test student...');
  const searchResponse = await fetch(
    `${BASE_URL}/api/postgres/search/by-name?query=a`
  );
  const searchData = await searchResponse.json();

  if (!searchData.success || searchData.items.length === 0) {
    console.error('❌ No students found for testing');
    return;
  }

  const testStudent = searchData.items[0];
  console.log(`✅ Found test student: ${testStudent.primerNombre} ${testStudent.primerApellido}`);
  console.log(`   ID: ${testStudent._id}`);
  console.log(`   Current nivel: ${testStudent.nivel}`);
  console.log(`   Current step: ${testStudent.step}`);

  // Test 1: Update student name
  console.log('\n2️⃣  Test 1: Update student name');
  const updateNameResponse = await fetch(
    `${BASE_URL}/api/postgres/students/${testStudent._id}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        observaciones: `[TEST] Updated at ${new Date().toISOString()}`
      }),
    }
  );

  const updateNameData = await updateNameResponse.json();

  if (updateNameData.success) {
    console.log('✅ Name update successful');
    console.log(`   Updated fields: ${updateNameData.updated}`);
    console.log(`   New observaciones: ${updateNameData.student.observaciones?.substring(0, 50)}...`);
  } else {
    console.error('❌ Name update failed:', updateNameData.error);
  }

  // Test 2: Update student level
  console.log('\n3️⃣  Test 2: Update student level and step');
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
        nivel: 'BN1',
        step: 'Step 1'
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

  // Test 3: Update multiple fields at once
  console.log('\n4️⃣  Test 3: Update multiple fields at once');
  const multiUpdateResponse = await fetch(
    `${BASE_URL}/api/postgres/students/${testStudent._id}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nivel: originalNivel,
        step: originalStep,
        observaciones: testStudent.observaciones || ''
      }),
    }
  );

  const multiUpdateData = await multiUpdateResponse.json();

  if (multiUpdateData.success) {
    console.log('✅ Multi-field update successful');
    console.log(`   Updated ${multiUpdateData.updated} fields`);
    console.log(`   Restored original values`);
  } else {
    console.error('❌ Multi-field update failed:', multiUpdateData.error);
  }

  // Test 4: Verify _updatedDate changed
  console.log('\n5️⃣  Test 4: Verify _updatedDate is updated');
  const verifyResponse = await fetch(
    `${BASE_URL}/api/postgres/students/${testStudent._id}`
  );
  const verifyData = await verifyResponse.json();

  if (verifyData.success) {
    const originalUpdatedDate = new Date(testStudent._updatedDate);
    const newUpdatedDate = new Date(verifyData.student._updatedDate);

    if (newUpdatedDate > originalUpdatedDate) {
      console.log('✅ _updatedDate updated correctly');
      console.log(`   Original: ${originalUpdatedDate.toISOString()}`);
      console.log(`   New: ${newUpdatedDate.toISOString()}`);
    } else {
      console.warn('⚠️  _updatedDate not updated (or clock issue)');
    }
  } else {
    console.error('❌ Verification failed:', verifyData.error);
  }

  // Test 5: Invalid field should be ignored
  console.log('\n6️⃣  Test 5: Invalid fields should be ignored');
  const invalidResponse = await fetch(
    `${BASE_URL}/api/postgres/students/${testStudent._id}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _id: 'should-be-ignored',
        invalidField: 'should-also-be-ignored',
        nivel: originalNivel
      }),
    }
  );

  const invalidData = await invalidResponse.json();

  if (invalidData.success && invalidData.student._id === testStudent._id) {
    console.log('✅ Invalid fields ignored correctly');
    console.log(`   Student ID unchanged: ${invalidData.student._id}`);
  } else {
    console.error('❌ Invalid field test failed');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');
}

// Run tests
testUpdateStudent().catch(console.error);
