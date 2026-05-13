/**
 * One-time script to seed the 4 special niveles after F3:
 *   MASTER (Step 46), IELS (Step 47), B2FIRST (Step 48), TOEFL (Step 49)
 *
 * Idempotent: ON CONFLICT DO NOTHING (uses ID uniqueness; if a row with the
 * same code+step already exists by chance, the UPSERT pattern would need a
 * proper unique constraint — for this seed, we check existence first).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: '.env.local' });

const NIVELES = [
  { code: 'MASTER',  nombreNivel: 'MASTER',  step: 'Step 46', description: 'Nivel posterior a F3 sin pruebas internacionales' },
  { code: 'IELS',    nombreNivel: 'IELS',    step: 'Step 47', description: 'Preparacion IELTS' },
  { code: 'B2FIRST', nombreNivel: 'B2FIRST', step: 'Step 48', description: 'Preparacion Cambridge B2 First' },
  { code: 'TOEFL',   nombreNivel: 'TOEFL',   step: 'Step 49', description: 'Preparacion TOEFL' },
];

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const n of NIVELES) {
      const exists = await pool.query(
        'SELECT "_id" FROM "NIVELES" WHERE "code" = $1 AND "step" = $2 LIMIT 1',
        [n.code, n.step]
      );
      if (exists.rows.length > 0) {
        console.log('YA EXISTE:', n.code, '-', n.step);
        continue;
      }
      const id = randomUUID();
      await pool.query(
        `INSERT INTO "NIVELES" ("_id", "code", "step", "nombreNivel", "description", "esParalelo", "origen")
         VALUES ($1, $2, $3, $4, $5, false, 'POSTGRES')`,
        [id, n.code, n.step, n.nombreNivel, n.description]
      );
      console.log('INSERTADO:', n.code, '-', n.step);
    }
    console.log('---');
    const v = await pool.query(
      `SELECT "code", "step", "nombreNivel" FROM "NIVELES"
       WHERE "code" IN ('MASTER','IELS','B2FIRST','TOEFL') ORDER BY "step"`
    );
    console.log('Verificacion final (' + v.rows.length + ' filas):');
    v.rows.forEach(r => console.log('  ' + r.code + ' - ' + r.step + ' (nombreNivel: ' + r.nombreNivel + ')'));
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
