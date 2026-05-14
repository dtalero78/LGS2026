/**
 * One-time normalization: reset PEOPLE.vigencia to '12' when
 *   - vigencia ≠ '12', AND
 *   - extensionCount = 0 (explicit "no extensions" — not NULL).
 *
 * Rationale: a non-12 vigencia is only legitimate when the contract was
 * actually extended (extensionCount > 0). Rows with extensionCount=0 carry
 * the explicit signal "this contract has never been extended", so any
 * deviation from the standard 12 months is a data-entry error from the Wix
 * migration — values like '4', '193', '350' have no business meaning.
 *
 * Counterpart to normalize-vigencia-without-extensions.js, which handled the
 * NULL case (extensionCount IS NULL) for values > 12. Together they cover
 * every shape of "unjustified non-12 vigencia".
 *
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
        AND "vigencia" <> '12'
        AND "extensionCount" = 0
    `);
    console.log('Filas con vigencia ≠ 12 y extensionCount = 0:', pre.rows[0].n);

    if (pre.rows[0].n === 0) {
      console.log('Nada por normalizar. Saliendo.');
      return;
    }

    const upd = await pool.query(`
      UPDATE "PEOPLE"
      SET "vigencia" = '12',
          "_updatedDate" = NOW()
      WHERE "vigencia" IS NOT NULL
        AND "vigencia" <> '12'
        AND "extensionCount" = 0
    `);
    console.log('Filas actualizadas:', upd.rowCount);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
