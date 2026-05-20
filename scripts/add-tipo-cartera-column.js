/**
 * One-time DDL: PAGOS_TITULARES.tipoCartera VARCHAR(20)
 *
 * Clasificación de cartera del pago. Valores esperados:
 *   - 'normal'      (default, pago en proceso regular)
 *   - 'prejuridico' (gestión de cobro previa a vía jurídica)
 *   - 'juridico'    (gestión de cobro jurídica activa)
 *   - 'castigada'   (cartera dada de baja contable)
 *
 * Default 'normal'. Idempotente (ADD COLUMN IF NOT EXISTS).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      ALTER TABLE "PAGOS_TITULARES"
      ADD COLUMN IF NOT EXISTS "tipoCartera" VARCHAR(20) DEFAULT 'normal'
    `);
    const cols = await pool.query(
      `SELECT data_type, character_maximum_length, column_default
       FROM information_schema.columns
       WHERE table_name='PAGOS_TITULARES' AND column_name='tipoCartera'`
    );
    if (cols.rowCount === 0) {
      console.log('⚠ columna no detectada');
      process.exitCode = 1;
    } else {
      const r = cols.rows[0];
      console.log(`OK — tipoCartera ${r.data_type}(${r.character_maximum_length}) default=${r.column_default ?? 'NULL'}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
