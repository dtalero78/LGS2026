/**
 * Migration: Create COMPLEMENTARIA_ATTEMPTS table
 * Also drops FK constraint on ACADEMICA_BOOKINGS.eventoId → CALENDARIO._id
 * (needed to allow COMPLEMENTARIA bookings without a calendar event)
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const connStr = DATABASE_URL.replace(/\?.*$/, '');
const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔧 Creating COMPLEMENTARIA_ATTEMPTS table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "COMPLEMENTARIA_ATTEMPTS" (
        "_id" VARCHAR(50) PRIMARY KEY,
        "studentId" VARCHAR(50) NOT NULL,
        "nivel" VARCHAR(20) NOT NULL,
        "step" VARCHAR(50) NOT NULL,
        "attemptNumber" INTEGER NOT NULL DEFAULT 1,
        "questions" JSONB NOT NULL,
        "answers" JSONB,
        "score" DECIMAL(5,2),
        "passed" BOOLEAN DEFAULT FALSE,
        "bookingId" VARCHAR(50),
        "status" VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
          CHECK ("status" IN ('IN_PROGRESS', 'PASSED', 'FAILED')),
        "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table COMPLEMENTARIA_ATTEMPTS created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comp_student_step
      ON "COMPLEMENTARIA_ATTEMPTS"("studentId", "nivel", "step");
    `);
    console.log('✅ Index idx_comp_student_step created');

    // Drop FK constraint on ACADEMICA_BOOKINGS.eventoId → CALENDARIO._id
    // This allows inserting COMPLEMENTARIA bookings without a calendar event
    await client.query(`
      ALTER TABLE "ACADEMICA_BOOKINGS"
      DROP CONSTRAINT IF EXISTS "ACADEMICA_BOOKINGS_eventoId_fkey";
    `);
    console.log('✅ FK constraint ACADEMICA_BOOKINGS_eventoId_fkey dropped');

    // Verify
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'COMPLEMENTARIA_ATTEMPTS'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Table structure:');
    rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // Check contenido field exists in NIVELES
    const { rows: nivelCols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'NIVELES' AND column_name = 'contenido'
    `);
    if (nivelCols.length > 0) {
      console.log('\n✅ NIVELES.contenido field exists');
      const { rows: sample } = await client.query(`
        SELECT "code", "step", LEFT("contenido", 100) as preview
        FROM "NIVELES"
        WHERE "contenido" IS NOT NULL AND "contenido" != ''
        LIMIT 3
      `);
      if (sample.length > 0) {
        console.log('📋 Sample contenido:');
        sample.forEach(r => console.log(`  ${r.code} / ${r.step}: ${r.preview}...`));
      } else {
        console.log('⚠️  contenido field exists but has no data');
      }
    } else {
      console.log('\n⚠️  NIVELES.contenido field does NOT exist');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
