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

async function verifyFix() {
  // Get random sample of 20 events
  const result = await pool.query(
    'SELECT "nombreEvento", "dia" FROM "CALENDARIO" WHERE "dia" IS NOT NULL ORDER BY RANDOM() LIMIT 20'
  );

  console.log('\nRandom sample of 20 events:');
  console.log('===========================');

  let correctCount = 0;
  let wrongCount = 0;

  result.rows.forEach((row, i) => {
    const dia = new Date(row.dia);
    const diaHour = dia.getUTCHours();
    const diaMin = dia.getUTCMinutes();
    const diaHasTime = diaHour !== 0 || diaMin !== 0;

    const status = diaHasTime ? '✅' : '⚠️ ';
    if (diaHasTime) correctCount++;
    else wrongCount++;

    console.log(`${i+1}. ${status} ${row.nombreEvento.substring(0,30)}: ${dia.toISOString()}`);
  });

  console.log('\n=============================');
  console.log(`✅ With time: ${correctCount}/20`);
  console.log(`⚠️  At 00:00: ${wrongCount}/20`);
  console.log('=============================');

  await pool.end();
}

verifyFix().catch(console.error);
