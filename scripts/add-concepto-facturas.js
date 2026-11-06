/**
 * Varias facturas por corte (2026-11-06): un advisor puede cobrar un corte en más de una
 * factura (p. ej. horas normales y Exam. Intern.). Cada una lleva su concepto y la revisión
 * compara la SUMA con lo calculado (src/services/liq-flujo.service.ts).
 * LIQ_ADVISOR_FACTURAS."concepto" = NORMAL | EXAM_INTERN | FESTIVO | OTRO (NULL = factura única).
 *
 * Uso: node scripts/add-concepto-facturas.js            (dry-run)
 *      node scripts/add-concepto-facturas.js --apply
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const SQL = [`ALTER TABLE "LIQ_ADVISOR_FACTURAS" ADD COLUMN IF NOT EXISTS "concepto" VARCHAR(20)`];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  if (!APPLY) { SQL.forEach(s => console.log(s)); console.log('\nDry-run. Use --apply para aplicar.'); await c.end(); return; }
  for (const s of SQL) await c.query(s);
  console.log('✅ LIQ_ADVISOR_FACTURAS.concepto lista');
  await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
