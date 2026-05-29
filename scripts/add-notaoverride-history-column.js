// Migración idempotente: agrega columna "notaoverrideHistory" JSONB a STEP_OVERRIDES.
// Guarda el historial append-only de cambios al override (motivo + actor + accion).
//   node scripts/add-notaoverride-history-column.js
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const exists = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='STEP_OVERRIDES' AND column_name='notaoverrideHistory'`);
    if (exists.rows.length) {
      console.log('Columna "notaoverrideHistory" ya existe. Nada que hacer.');
    } else {
      await pool.query(`ALTER TABLE "STEP_OVERRIDES" ADD COLUMN "notaoverrideHistory" JSONB DEFAULT '[]'::jsonb`);
      console.log('✅ Columna "notaoverrideHistory" creada (JSONB default []).');
    }
    const cnt = await pool.query(`SELECT COUNT(*)::int n FROM "STEP_OVERRIDES"`);
    console.log(`Filas existentes en STEP_OVERRIDES: ${cnt.rows[0].n} (history vacía hasta el próximo cambio).`);
  } finally {
    await pool.end();
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
