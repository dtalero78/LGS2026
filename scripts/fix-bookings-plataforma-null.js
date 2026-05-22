/**
 * Backfill plataforma en ACADEMICA_BOOKINGS para bookings creados desde
 * 2026-05-21 (cuando el commit daadaf2 introdujo el bug) que quedaron
 * con plataforma NULL.
 *
 * Para cada booking afectado, busca la plataforma en PEOPLE por:
 *   1. PEOPLE._id = booking.idEstudiante OR booking.studentId
 *   2. (fallback) PEOPLE.numeroId = booking.numeroId
 *
 * Si la plataforma se resuelve y es no-vacía, actualiza el booking.
 * Idempotente: solo toca filas con plataforma NULL/vacía.
 *
 * Modos:
 *   node scripts/fix-bookings-plataforma-null.js           → dry-run
 *   node scripts/fix-bookings-plataforma-null.js --apply   → ejecuta
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

    if (APPLY) {
      // UPDATE en una sola query usando subquery: lookup PEOPLE por _id o numeroId
      const upd = await pool.query(`
        UPDATE "ACADEMICA_BOOKINGS" b
        SET "plataforma" = src."plataforma",
            "_updatedDate" = NOW()
        FROM (
          SELECT b2."_id" AS booking_id, p."plataforma"
          FROM "ACADEMICA_BOOKINGS" b2
          JOIN "PEOPLE" p
            ON p."_id" = b2."idEstudiante"
            OR p."_id" = b2."studentId"
            OR (b2."numeroId" IS NOT NULL AND p."numeroId" = b2."numeroId")
          WHERE (b2."plataforma" IS NULL OR b2."plataforma" = '')
            AND b2."_createdDate" >= '2026-05-21'
            AND p."plataforma" IS NOT NULL
            AND p."plataforma" <> ''
        ) src
        WHERE b."_id" = src.booking_id
      `);
      console.log(`✓ ${upd.rowCount} bookings actualizados con plataforma desde PEOPLE.`);
    } else {
      const preview = await pool.query(`
        SELECT COUNT(*)::int AS n
        FROM "ACADEMICA_BOOKINGS" b
        WHERE (b."plataforma" IS NULL OR b."plataforma" = '')
          AND b."_createdDate" >= '2026-05-21'
          AND EXISTS (
            SELECT 1 FROM "PEOPLE" p
            WHERE p."_id" = b."idEstudiante"
              OR p."_id" = b."studentId"
              OR (b."numeroId" IS NOT NULL AND p."numeroId" = b."numeroId")
            AND COALESCE(p."plataforma", '') <> ''
          )
      `);
      console.log(`Bookings a actualizar: ${preview.rows[0].n}`);
      console.log(`\nDry-run. Para aplicar:\n  node scripts/fix-bookings-plataforma-null.js --apply`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
