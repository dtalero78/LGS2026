/**
 * Agrega columnas de sesión SENCE a ACADEMICA_BOOKINGS (idempotente):
 *   - idSesionSence        VARCHAR(100)  → id de la sesión en SENCE (alfanumérico).
 *   - senceSessionClosedAt TIMESTAMPTZ   → cuándo se cerró la sesión en SENCE.
 *
 * Uso: node scripts/add-sence-session-columns.js
 * (Ya aplicado en producción vía scripts/db.js el 2026-08; queda como registro.
 *  Requiere IP whitelisteada en el firewall.)
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('ALTER TABLE "ACADEMICA_BOOKINGS" ADD COLUMN IF NOT EXISTS "idSesionSence" VARCHAR(100)');
    await client.query('ALTER TABLE "ACADEMICA_BOOKINGS" ADD COLUMN IF NOT EXISTS "senceSessionClosedAt" TIMESTAMPTZ');
    const r = await client.query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_name = 'ACADEMICA_BOOKINGS' AND column_name IN ('idSesionSence','senceSessionClosedAt')
        ORDER BY column_name`
    );
    console.log('✅ Columnas:', r.rows);
  } finally {
    await client.end();
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
