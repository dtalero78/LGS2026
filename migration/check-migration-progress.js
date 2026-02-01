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

async function checkProgress() {
  // Sample ACADEMICA dates
  const academica = await pool.query(
    `SELECT "fechaContrato", "finalContrato"
     FROM "ACADEMICA"
     WHERE "fechaContrato" IS NOT NULL OR "finalContrato" IS NOT NULL
     LIMIT 5`
  );

  console.log('\nACADEMICA sample dates:');
  console.log('======================');
  academica.rows.forEach((row, i) => {
    const fc = row.fechaContrato ? new Date(row.fechaContrato) : null;
    const ff = row.finalContrato ? new Date(row.finalContrato) : null;

    console.log(`${i+1}. fechaContrato: ${fc ? fc.toISOString() + ' (hour: ' + fc.getUTCHours() + ')' : 'null'}`);
    console.log(`   finalContrato: ${ff ? ff.toISOString() + ' (hour: ' + ff.getUTCHours() + ')' : 'null'}`);
  });

  // Sample PEOPLE dates
  const people = await pool.query(
    `SELECT "fechaNacimiento", "finalContrato"
     FROM "PEOPLE"
     WHERE "fechaNacimiento" IS NOT NULL OR "finalContrato" IS NOT NULL
     LIMIT 5`
  );

  console.log('\nPEOPLE sample dates:');
  console.log('===================');
  people.rows.forEach((row, i) => {
    const fn = row.fechaNacimiento ? new Date(row.fechaNacimiento) : null;
    const ff = row.finalContrato ? new Date(row.finalContrato) : null;

    console.log(`${i+1}. fechaNacimiento: ${fn ? fn.toISOString() + ' (hour: ' + fn.getUTCHours() + ')' : 'null'}`);
    console.log(`   finalContrato: ${ff ? ff.toISOString() + ' (hour: ' + ff.getUTCHours() + ')' : 'null'}`);
  });

  await pool.end();
}

checkProgress().catch(console.error);
