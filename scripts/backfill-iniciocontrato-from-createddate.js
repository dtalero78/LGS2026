/**
 * One-time backfill: derive PEOPLE.inicioContrato from _createdDate when both
 * inicioContrato AND finalContrato are NULL (so the 12-months derivation can't
 * be applied).
 *
 * Last-resort fill for orphan records left over from the Wix migration that
 * never carried any contract date. We assume the record was created on the
 * same date the contract started. The _createdDate is converted to a date in
 * America/Bogota to avoid a UTC-cast off-by-one when the row was created in
 * the evening (Bogotá).
 *
 * Idempotent: only updates rows with inicioContrato IS NULL.
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
      WHERE "inicioContrato" IS NULL
        AND "_createdDate"   IS NOT NULL
    `);
    console.log('Filas rellenables (inicioContrato NULL, _createdDate disponible):', pre.rows[0].rellenable);

    if (pre.rows[0].rellenable === 0) {
      console.log('Nada por rellenar. Saliendo.');
      return;
    }

    const upd = await pool.query(`
      UPDATE "PEOPLE"
      SET "inicioContrato" = ("_createdDate" AT TIME ZONE 'America/Bogota')::date,
          "_updatedDate"   = NOW()
      WHERE "inicioContrato" IS NULL
        AND "_createdDate"   IS NOT NULL
    `);
    console.log('Filas actualizadas:', upd.rowCount);

    const after = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE "inicioContrato" IS NOT NULL)::int AS con_inicio,
             COUNT(*) FILTER (WHERE "inicioContrato" IS NULL)::int AS sin_inicio
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
