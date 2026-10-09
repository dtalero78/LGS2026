/**
 * add-modulo-column.js
 *
 * Agrega PEOPLE."modulo" (BOOLEAN NOT NULL DEFAULT false): marca los contratos
 * creados con el botón MODULO de Crear Contrato (vigencia fija de 3 meses).
 * Se guarda en el titular y en cada beneficiario, igual que "vigencia".
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Con default constante es un cambio
 * solo de metadatos (no reescribe la tabla). lock_timeout corto para no quedar
 * encolado detrás de tráfico.
 *   node scripts/add-modulo-column.js           (dry-run: muestra el SQL)
 *   node scripts/add-modulo-column.js --apply
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');

const SQL = `ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "modulo" BOOLEAN NOT NULL DEFAULT false`;

(async () => {
  if (!process.argv.includes('--apply')) {
    console.log(SQL);
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
    await c.query(SQL);
    const r = await c.query(`SELECT COUNT(*) FILTER (WHERE "modulo")::int AS modulo, COUNT(*)::int AS total FROM "PEOPLE"`);
    console.log(`✅ PEOPLE.modulo lista (${r.rows[0].modulo} de ${r.rows[0].total} marcados).`);
  } finally {
    await c.end();
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
