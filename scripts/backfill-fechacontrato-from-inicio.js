/**
 * One-time backfill: copy PEOPLE.inicioContrato → PEOPLE.fechaContrato
 * when fechaContrato is NULL.
 *
 * Background: both fields mean "contract signing date" in different eras of
 * the platform (inicioContrato = Wix-era, fechaContrato = POSTGRES-era).
 * Wix migration left 9000+ rows with only inicioContrato populated; this
 * backfill consolidates so fechaContrato is the canonical column going forward.
 *
 * Idempotent: only updates rows with fechaContrato IS NULL. Rows with both
 * fields populated and differing values are left untouched (52 conflicts as
 * of the first run — those keep their existing fechaContrato).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const pre = await pool.query(`
      SELECT COUNT(*)::int AS rellenable
      FROM "PEOPLE"
      WHERE "fechaContrato" IS NULL
        AND "inicioContrato" IS NOT NULL
    `);
    console.log('Filas con fechaContrato NULL e inicioContrato disponible:', pre.rows[0].rellenable);

    if (pre.rows[0].rellenable === 0) {
      console.log('Nada por rellenar. Saliendo.');
      return;
    }

    const upd = await pool.query(`
      UPDATE "PEOPLE"
      SET "fechaContrato" = "inicioContrato",
          "_updatedDate"  = NOW()
      WHERE "fechaContrato" IS NULL
        AND "inicioContrato" IS NOT NULL
    `);
    console.log('Filas actualizadas:', upd.rowCount);

    const after = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE "fechaContrato" IS NOT NULL)::int AS con_fecha
      FROM "PEOPLE"
    `);
    console.log('Estado final:', after.rows[0]);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
