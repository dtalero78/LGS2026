/**
 * Test script for NIVELES exporter
 * Quick test to validate the entire migration flow
 *
 * Usage:
 *   node migration/test-niveles.js              # Normal run
 *   node migration/test-niveles.js --dry-run    # Dry run (no DB writes)
 *   node migration/test-niveles.js --max=5      # Limit to 5 records
 */

require('dotenv').config();
const { Pool } = require('pg');
const NivelesExporter = require('./exporters/01-niveles');
const config = require('./config');

async function testNivelesExport() {
  const pool = new Pool(config.postgres);

  console.log('\n' + '='.repeat(70));
  console.log('🧪 TESTING NIVELES EXPORT');
  console.log('='.repeat(70));

  try {
    // Step 1: Test PostgreSQL connection
    console.log('\n📋 Step 1: Testing PostgreSQL connection...');
    const pgResult = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected');
    console.log('   Version:', pgResult.rows[0].version.substring(0, 50) + '...');

    // Step 2: Check if NIVELES table exists
    console.log('\n📋 Step 2: Checking if NIVELES table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'NIVELES'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ NIVELES table does not exist!');
      console.log('\nPlease run the schema first:');
      console.log('   psql -d lgs_admin -f migration/schema.sql');
      process.exit(1);
    }
    console.log('✅ NIVELES table exists');

    // Step 3: Get current record count
    console.log('\n📋 Step 3: Getting current NIVELES count...');
    const countBefore = await pool.query('SELECT COUNT(*) FROM "NIVELES"');
    console.log(`✅ Current records in NIVELES: ${countBefore.rows[0].count}`);

    // Step 4: Test Wix endpoint
    console.log('\n📋 Step 4: Testing Wix endpoint...');
    const fetch = require('node-fetch');
    const wixUrl = `${config.wix.baseUrl}${config.wixEndpoints.NIVELES}?skip=0&limit=5`;
    console.log('   URL:', wixUrl);

    const wixResponse = await fetch(wixUrl, { timeout: 30000 });
    if (!wixResponse.ok) {
      throw new Error(`Wix API error: ${wixResponse.status}`);
    }

    const wixData = await wixResponse.json();
    console.log('✅ Wix endpoint accessible');
    console.log(`   Sample records available: ${wixData.items?.length || 0}`);
    console.log(`   Total in Wix: ${wixData.totalCount || 'unknown'}`);

    if (wixData.items && wixData.items.length > 0) {
      const sample = wixData.items[0];
      console.log('\n   Sample record structure:');
      console.log('   - _id:', sample._id);
      console.log('   - code:', sample.code);
      console.log('   - step:', sample.step);
      console.log('   - esParalelo:', sample.esParalelo);
      console.log('   - material:', Array.isArray(sample.material) ? `[${sample.material.length} items]` : typeof sample.material);
    }

    // Step 5: Run the export
    console.log('\n📋 Step 5: Running export...');
    const exporter = new NivelesExporter();

    const isDryRun = process.argv.includes('--dry-run');
    const maxRecords = process.argv.find(arg => arg.startsWith('--max='))?.split('=')[1];

    const result = await exporter.export(pool, {
      dryRun: isDryRun,
      maxRecords: maxRecords ? parseInt(maxRecords) : null,
    });

    // Step 6: Verify results
    if (!isDryRun) {
      console.log('\n📋 Step 6: Verifying results...');
      const countAfter = await pool.query('SELECT COUNT(*) FROM "NIVELES"');
      console.log(`✅ Records after export: ${countAfter.rows[0].count}`);

      const difference = parseInt(countAfter.rows[0].count) - parseInt(countBefore.rows[0].count);
      if (difference > 0) {
        console.log(`   📈 ${difference} new records inserted`);
      } else {
        console.log('   ℹ️  No new records (existing records were updated)');
      }

      // Sample some records
      console.log('\n📋 Step 7: Sampling migrated records...');
      const sample = await pool.query(`
        SELECT "_id", "code", "step", "esParalelo", "origen"
        FROM "NIVELES"
        LIMIT 5
      `);

      console.log('✅ Sample records from PostgreSQL:');
      sample.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.code} (${row.step}) - Paralelo: ${row.esParalelo} - Origen: ${row.origen}`);
      });

      // Check JSONB fields
      console.log('\n📋 Step 8: Checking JSONB fields...');
      const jsonbCheck = await pool.query(`
        SELECT "code", "material", "clubs", "steps"
        FROM "NIVELES"
        WHERE "material" IS NOT NULL OR "clubs" IS NOT NULL OR "steps" IS NOT NULL
        LIMIT 1
      `);

      if (jsonbCheck.rows.length > 0) {
        const row = jsonbCheck.rows[0];
        console.log('✅ JSONB fields validation:');
        console.log(`   Code: ${row.code}`);
        console.log(`   Material: ${typeof row.material === 'object' ? 'Valid JSON' : 'Invalid'}`);
        console.log(`   Clubs: ${typeof row.clubs === 'object' ? 'Valid JSON' : 'Invalid'}`);
        console.log(`   Steps: ${typeof row.steps === 'object' ? 'Valid JSON' : 'Invalid'}`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('Summary:');
    console.log(`  - Records processed: ${result.totalProcessed}`);
    console.log(`  - Inserted: ${result.totalInserted}`);
    console.log(`  - Updated: ${result.totalUpdated}`);
    console.log(`  - Failed: ${result.totalFailed}`);
    console.log(`  - Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`  - Rate: ${result.rate} records/sec`);
    console.log('='.repeat(70) + '\n');

    if (result.totalFailed > 0) {
      console.warn('⚠️  Warning: Some records failed. Check logs above for details.');
    }

    if (isDryRun) {
      console.log('ℹ️  This was a DRY RUN - no data was written to PostgreSQL');
    }

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(70));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔌 PostgreSQL connection closed\n');
  }
}

// Run the test
testNivelesExport();
