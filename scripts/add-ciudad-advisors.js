/* Agrega ADVISORS.ciudadadvisor (TEXT, nullable). Idempotente. Uso: node scripts/add-ciudad-advisors.js [--apply] */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const ya = (await c.query(`SELECT 1 FROM information_schema.columns WHERE table_name='ADVISORS' AND column_name='ciudadadvisor'`)).rowCount;
  console.log(ya ? 'La columna ya existe' : 'Falta la columna ciudadadvisor');
  if (!ya && process.argv.includes('--apply')) { await c.query(`ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "ciudadadvisor" TEXT`); console.log('Creada'); }
  else if (!ya) console.log('(dry-run — use --apply)');
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
