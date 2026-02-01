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

// Columns to fix: change from DATE to TIMESTAMP WITH TIME ZONE
const columnsToFix = {
  PEOPLE: [
    'fechaContrato',
    'fechaFinOnHold',
    'fechaIngreso',
    'fechaNacimiento',
    'fechaOnHold',
    'finalContrato'
  ],
  ACADEMICA: [
    'fechaContrato',
    'fechaNacimiento',
    'finalContrato'
  ],
  FINANCIEROS: [
    'fechaPago',
    'fechaUltimoPago'
  ],
  ACADEMICA_BOOKINGS: [
    'fecha'
  ]
};

async function fixDateColumns() {
  console.log('\n🔧 Fixing DATE columns to TIMESTAMP WITH TIME ZONE\n');
  console.log('='.repeat(70));

  for (const [table, columns] of Object.entries(columnsToFix)) {
    console.log(`\n📋 Table: ${table}`);
    console.log('-'.repeat(70));

    for (const column of columns) {
      try {
        console.log(`   Converting "${column}"...`);

        const query = `
          ALTER TABLE "${table}"
          ALTER COLUMN "${column}"
          TYPE timestamp with time zone
          USING "${column}"::timestamp with time zone
        `;

        await pool.query(query);
        console.log(`   ✅ ${column} converted successfully`);
      } catch (error) {
        console.error(`   ❌ Failed to convert ${column}:`, error.message);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Date column conversion complete!');
  console.log('='.repeat(70) + '\n');

  await pool.end();
}

fixDateColumns().catch(console.error);
