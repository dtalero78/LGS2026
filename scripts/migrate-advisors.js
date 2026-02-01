/**
 * Script para migrar la tabla ADVISORS desde Wix a PostgreSQL
 *
 * Uso: node scripts/migrate-advisors.js
 *
 * Requiere: DATABASE_URL en las variables de entorno (Digital Ocean)
 */

const { Pool } = require('pg');

// Configuración de PostgreSQL para Digital Ocean
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const WIX_API_URL = 'https://www.lgsplataforma.com/_functions/advisors';

async function fetchAdvisorsFromWix() {
  console.log('📥 Fetching advisors from Wix...');

  const response = await fetch(WIX_API_URL, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Wix API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.advisors) {
    throw new Error('Invalid response from Wix');
  }

  console.log(`✅ Fetched ${data.advisors.length} advisors from Wix`);
  return data.advisors;
}

async function createAdvisorsTable() {
  console.log('📋 Creating ADVISORS table...');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS "ADVISORS" (
      "_id" VARCHAR(255) PRIMARY KEY,
      "primerNombre" VARCHAR(255),
      "primerApellido" VARCHAR(255),
      "nombreCompleto" VARCHAR(255),
      "email" VARCHAR(255),
      "zoom" TEXT,
      "telefono" VARCHAR(50),
      "pais" VARCHAR(100),
      "activo" BOOLEAN DEFAULT true,
      "_createdDate" TIMESTAMP DEFAULT NOW(),
      "_updatedDate" TIMESTAMP DEFAULT NOW()
    );
  `;

  await pool.query(createTableSQL);
  console.log('✅ ADVISORS table created/verified');
}

async function insertAdvisors(advisors) {
  console.log('📝 Inserting advisors into PostgreSQL...');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const advisor of advisors) {
    try {
      // Upsert - insert or update if exists
      const upsertSQL = `
        INSERT INTO "ADVISORS" (
          "_id", "primerNombre", "primerApellido", "nombreCompleto",
          "email", "zoom", "activo", "_createdDate", "_updatedDate"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT ("_id") DO UPDATE SET
          "primerNombre" = EXCLUDED."primerNombre",
          "primerApellido" = EXCLUDED."primerApellido",
          "nombreCompleto" = EXCLUDED."nombreCompleto",
          "email" = EXCLUDED."email",
          "zoom" = EXCLUDED."zoom",
          "_updatedDate" = NOW()
        RETURNING (xmax = 0) AS inserted;
      `;

      const result = await pool.query(upsertSQL, [
        advisor._id,
        advisor.primerNombre || null,
        advisor.primerApellido || null,
        advisor.nombreCompleto || null,
        advisor.email || null,
        advisor.zoom || null,
        true, // activo por defecto
      ]);

      if (result.rows[0].inserted) {
        inserted++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`❌ Error inserting advisor ${advisor._id}:`, error.message);
      errors++;
    }
  }

  console.log(`\n📊 Migration Results:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📋 Total processed: ${advisors.length}`);
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  const countResult = await pool.query('SELECT COUNT(*) as total FROM "ADVISORS"');
  const sampleResult = await pool.query(`
    SELECT "_id", "nombreCompleto", "email"
    FROM "ADVISORS"
    ORDER BY "nombreCompleto"
    LIMIT 5
  `);

  console.log(`✅ Total advisors in PostgreSQL: ${countResult.rows[0].total}`);
  console.log('\n📋 Sample records:');
  sampleResult.rows.forEach((row, i) => {
    console.log(`   ${i + 1}. ${row.nombreCompleto} - ${row.email}`);
  });
}

async function main() {
  console.log('🚀 Starting ADVISORS migration...\n');

  try {
    // 1. Fetch from Wix
    const advisors = await fetchAdvisorsFromWix();

    // 2. Create table
    await createAdvisorsTable();

    // 3. Insert data
    await insertAdvisors(advisors);

    // 4. Verify
    await verifyMigration();

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
