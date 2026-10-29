/**
 * add-listo-aprobacion.js
 *
 * Agrega a PEOPLE la marca "Dejar listo para aprobación" del contrato (solo se
 * usa en el TITULAR):
 *   "listoAprobacion"    BOOLEAN NOT NULL DEFAULT false
 *   "listoAprobacionPor" VARCHAR(200)   — correo de quien lo marcó
 *   "listoAprobacionEn"  TIMESTAMPTZ
 * La marca el botón de /dashboard/comercial/contrato/[id] tras confirmar firma,
 * PDF, documentos/recibo e información; el Libro de Producción lo muestra como
 * "Firma, Documentos, pendiente aprobación".
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS; default constante = solo metadatos).
 *   node scripts/add-listo-aprobacion.js           (dry-run: muestra el SQL)
 *   node scripts/add-listo-aprobacion.js --apply
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');

const SQL = [
  `ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "listoAprobacion" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "listoAprobacionPor" VARCHAR(200)`,
  `ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "listoAprobacionEn" TIMESTAMPTZ`,
];

(async () => {
  if (!process.argv.includes('--apply')) {
    SQL.forEach((s) => console.log(s + ';'));
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
    for (const s of SQL) await c.query(s);
    const r = await c.query(`SELECT COUNT(*) FILTER (WHERE "listoAprobacion")::int AS listos FROM "PEOPLE"`);
    console.log(`✅ PEOPLE.listoAprobacion lista (${r.rows[0].listos} marcados).`);
  } finally {
    await c.end();
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
