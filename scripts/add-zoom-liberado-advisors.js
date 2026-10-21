/**
 * add-zoom-liberado-advisors.js — al desactivar un advisor se libera su sala de Zoom
 * (ADVISORS.zoom = NULL) para poder asignarla a otro; el link anterior queda guardado
 * en "zoomLiberado" con la fecha en "zoomLiberadoEn" (consulta / recuperación).
 *
 * Idempotente (IF NOT EXISTS). Dry-run por defecto; --apply ejecuta.
 * Uso: node scripts/add-zoom-liberado-advisors.js [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const SQL = `ALTER TABLE "ADVISORS"
  ADD COLUMN IF NOT EXISTS "zoomLiberado"   TEXT,
  ADD COLUMN IF NOT EXISTS "zoomLiberadoEn" TIMESTAMPTZ`;

(async () => {
  if (!process.argv.includes('--apply')) { console.log('DRY-RUN — SQL:\n' + SQL); return; }
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try { await c.query(SQL); console.log('✔ ADVISORS.zoomLiberado / zoomLiberadoEn listas.'); } finally { await c.end(); }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
