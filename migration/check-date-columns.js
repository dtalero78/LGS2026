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

async function checkDateColumns() {
  const tables = ['PEOPLE', 'ACADEMICA', 'FINANCIEROS', 'ACADEMICA_BOOKINGS'];

  for (const table of tables) {
    const result = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = $1
         AND data_type IN ($2, $3, $4)
       ORDER BY column_name`,
      [table, 'date', 'timestamp with time zone', 'timestamp without time zone']
    );

    console.log(`\n${table}:`);
    console.log('='.repeat(60));
    if (result.rows.length === 0) {
      console.log('  (No date/timestamp columns found)');
    } else {
      result.rows.forEach(row => {
        console.log(`  ${row.column_name.padEnd(30)} ${row.data_type}`);
      });
    }
  }

  await pool.end();
}

checkDateColumns().catch(console.error);
