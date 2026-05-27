/**
 * Migración: PAGOS_TITULARES.fechaReporte DATE
 *
 * Separa el concepto "cuándo pagó el titular" (`fechaPago`) del "cuándo se
 * registró/reportó el pago en el sistema" (`fechaReporte`, default hoy en
 * el wizard). Antes ambos usaban la misma columna `fechaPago`, lo que
 * mezclaba la realidad operativa con la fecha contable.
 *
 * Default NULL para registros previos (cuota#0 + pagos anteriores quedan
 * sin reporte explícito; se asume que coincide con `fechaPago` o
 * `_createdDate` para uso histórico).
 *
 * Idempotente: ADD COLUMN IF NOT EXISTS.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      ALTER TABLE "PAGOS_TITULARES"
      ADD COLUMN IF NOT EXISTS "fechaReporte" DATE
    `);
    const cols = await pool.query(
      `SELECT data_type, column_default
       FROM information_schema.columns
       WHERE table_name='PAGOS_TITULARES' AND column_name='fechaReporte'`
    );
    if (cols.rowCount === 0) {
      console.log('⚠ columna no detectada');
      process.exitCode = 1;
    } else {
      const r = cols.rows[0];
      console.log(`OK — fechaReporte ${r.data_type} default=${r.column_default ?? 'NULL'}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
