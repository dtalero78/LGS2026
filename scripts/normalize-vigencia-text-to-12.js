/**
 * One-time normalization: replace PEOPLE.vigencia values containing text or
 * spaces with the canonical '12'.
 *
 * Background: legacy Wix data carried inconsistent string formats — '12 meses',
 * '12 ', '12 MESES', '13 meses', etc. — which break any equality comparison
 * against '12'. All these values were intended to mean "12 months" (or '13'
 * variants already conflated to '12' per platform policy).
 *
 * Matches any vigencia that is NOT a pure run of digits (`^[0-9]+$`).
 * Idempotent.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const pre = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM "PEOPLE"
      WHERE "vigencia" IS NOT NULL
        AND "vigencia" !~ '^[0-9]+$'
    `);
    console.log('Filas no numéricas puras:', pre.rows[0].n);

    if (pre.rows[0].n === 0) {
      console.log('Nada por normalizar. Saliendo.');
      return;
    }

    const upd = await pool.query(`
      UPDATE "PEOPLE"
      SET "vigencia" = '12',
          "_updatedDate" = NOW()
      WHERE "vigencia" IS NOT NULL
        AND "vigencia" !~ '^[0-9]+$'
    `);
    console.log('Filas actualizadas:', upd.rowCount);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
