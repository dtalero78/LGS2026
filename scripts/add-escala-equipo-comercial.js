/**
 * add-escala-equipo-comercial.js
 *
 * Agrega a EQUIPO_COMERCIAL la escala comercial vigente de cada ejecutivo:
 *   fullExecutive, jefeGrupo, gerente, gerenteDivision, salesManager (TEXT)
 *   escalaActualizada (TIMESTAMPTZ) — cuándo llegó por última vez desde el CRM.
 * Se llenan solos cada vez que se crea un contrato con el enlace firmado del CRM
 * (POST /api/postgres/contracts); Crear Contrato la muestra en el paso 1.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS, solo metadatos). lock_timeout corto.
 *   node scripts/add-escala-equipo-comercial.js           (dry-run: muestra el SQL)
 *   node scripts/add-escala-equipo-comercial.js --apply
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');

const COLS = ['fullExecutive', 'jefeGrupo', 'gerente', 'gerenteDivision', 'salesManager'];
const SQL = [
  ...COLS.map(c => `ALTER TABLE "EQUIPO_COMERCIAL" ADD COLUMN IF NOT EXISTS "${c}" TEXT`),
  `ALTER TABLE "EQUIPO_COMERCIAL" ADD COLUMN IF NOT EXISTS "escalaActualizada" TIMESTAMPTZ`,
];

(async () => {
  if (!process.argv.includes('--apply')) {
    SQL.forEach(s => console.log(s + ';'));
    console.log('(dry-run — use --apply para ejecutar)');
    return;
  }
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query(`SET lock_timeout = '5s'`);
    await c.query('BEGIN');
    for (const s of SQL) await c.query(s);
    await c.query('COMMIT');
    const r = await c.query(`SELECT COUNT(*)::int AS total FROM "EQUIPO_COMERCIAL"`);
    console.log(`✅ EQUIPO_COMERCIAL con escala lista (${r.rows[0].total} registros, aún sin escala).`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
