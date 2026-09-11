/**
 * Agrega columnas de penalidad a PAGOS_TITULARES (idempotente):
 *   - vlrpenalidad NUMERIC(12,2)  → cuando penalidad=true, el valor de la cuota
 *                                    se guarda acá en vez de en valorCuota.
 *   - penalidad    BOOLEAN DEFAULT false → marca el pago como penalidad.
 *
 * Uso: node scripts/add-penalidad-columns.js
 * (Ya aplicado en producción vía scripts/db.js el 2026-07; este script queda
 *  como registro/repetibilidad. Requiere IP whitelisteada en el firewall.)
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
    await client.query('ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "vlrpenalidad" NUMERIC(12,2)');
    await client.query('ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "penalidad" BOOLEAN DEFAULT false');
    const r = await client.query(
      `SELECT column_name, data_type, column_default
       FROM information_schema.columns
       WHERE table_name = 'PAGOS_TITULARES' AND column_name IN ('vlrpenalidad','penalidad')
       ORDER BY column_name`
    );
    console.log('✅ Columnas:', r.rows);
  } finally {
    await client.end();
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
