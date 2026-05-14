/**
 * One-time normalization: reset PEOPLE.vigencia to '12' when
 *   - vigencia is numeric AND vigencia > 12, AND
 *   - extensionCount IS NULL (no extensions on record)
 *
 * Rationale: the standard contract vigencia is 12 months. Values >12 should
 * only exist when the contract was actually extended (extensionCount > 0).
 * Migrated Wix rows had garbage values like '92', '5057', etc. with no
 * corresponding extensionHistory, indicating those numbers were never real
 * vigencia values. This script restores them to the canonical 12.
 *
 * Rows with vigencia > 12 AND extensionCount > 0 are LEFT UNTOUCHED — those
 * are legitimate extensions.
 *
 * Idempotent: only matches the precise condition above, so re-running has no
 * effect.
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
      WHERE "vigencia" ~ '^[0-9]+$'
        AND "vigencia"::int > 12
        AND "extensionCount" IS NULL
    `);
    console.log('Filas con vigencia > 12 y extensionCount NULL:', pre.rows[0].n);

    if (pre.rows[0].n === 0) {
      console.log('Nada por normalizar. Saliendo.');
      return;
    }

    const upd = await pool.query(`
      UPDATE "PEOPLE"
      SET "vigencia" = '12',
          "_updatedDate" = NOW()
      WHERE "vigencia" ~ '^[0-9]+$'
        AND "vigencia"::int > 12
        AND "extensionCount" IS NULL
    `);
    console.log('Filas actualizadas:', upd.rowCount);

    const after = await pool.query(`
      SELECT COUNT(*)::int AS quedaron
      FROM "PEOPLE"
      WHERE "vigencia" ~ '^[0-9]+$'
        AND "vigencia"::int > 12
        AND "extensionCount" IS NULL
    `);
    console.log('Filas con vigencia>12 + extensionCount NULL restantes (debe ser 0):', after.rows[0].quedaron);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
