const { Pool } = require('pg');
const fs = require('fs');

let dbUrl = '';
try {
  const env = fs.readFileSync('/Users/danieltalero/Desktop/REPOS/LGS 2026/LGS2026/.env.local', 'utf8');
  const match = env.match(/DATABASE_URL=(.+)/);
  if (match) dbUrl = match[1].trim();
} catch(e) {}

if (!dbUrl) { console.error('No DATABASE_URL found'); process.exit(1); }

const cleanUrl = dbUrl.replace('?sslmode=require', '');
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });

pool.query('ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "documentacion" JSONB DEFAULT \'[]\'::jsonb')
  .then(() => {
    console.log('✅ Column documentacion added (or already existed)');
    pool.end();
  })
  .catch(e => {
    console.error('❌', e.message);
    pool.end();
    process.exit(1);
  });
