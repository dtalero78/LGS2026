/**
 * Facturas de guías Kids (fase 2): se suben en KIDS y LGS las toma desde allá
 * (lib/kids-facturas-guias.ts). LIQ_ADVISOR_FACTURAS."kidsFacturaId" = id de la factura
 * en KIDS (liquidacion_factura_guia.id) para devolverle cada cambio de estado.
 *
 * Uso: node scripts/add-facturas-kids.js            (dry-run)
 *      node scripts/add-facturas-kids.js --apply
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const SQL = [
  `ALTER TABLE "LIQ_ADVISOR_FACTURAS" ADD COLUMN IF NOT EXISTS "kidsFacturaId" VARCHAR(64)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_liq_facturas_kids" ON "LIQ_ADVISOR_FACTURAS" ("kidsFacturaId") WHERE "kidsFacturaId" IS NOT NULL`,
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  if (!APPLY) { SQL.forEach(s => console.log(s)); console.log('\nDry-run. Use --apply para aplicar.'); await c.end(); return; }
  await c.query('BEGIN');
  try { for (const s of SQL) await c.query(s); await c.query('COMMIT'); console.log('✅ LIQ_ADVISOR_FACTURAS.kidsFacturaId lista'); }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
