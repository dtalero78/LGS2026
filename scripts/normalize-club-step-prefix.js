/**
 * One-time normalization: when a CLUB event/booking has a prefixed
 * `nombreEvento` (e.g. "TRAINING - Step 7", "KARAOKE - Step 13") but the
 * `step` column stores only the plain "Step N", copy the full nombreEvento
 * into step so downstream logic can identify the club type by step alone.
 *
 * Two tables affected:
 *   1. CALENDARIO   — only rows with tipo='CLUB' (the 2 SESSION rows with
 *                     club-style nombreEvento are data-entry errors that
 *                     require manual review and are NOT touched).
 *   2. ACADEMICA_BOOKINGS — excludes tipo='COMPLEMENTARIA' (those are AI
 *                     quizzes, not clubs).
 *
 * Idempotent: filter `step NOT LIKE '%-%'` so already-prefixed rows are
 * skipped on subsequent runs.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // ─── CALENDARIO (only CLUB) ───────────────────────────────────────
    console.log('=== CALENDARIO (tipo=CLUB) ===');
    const calPre = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM "CALENDARIO"
      WHERE "tipo" = 'CLUB'
        AND "nombreEvento" LIKE '% - Step %'
        AND "nombreEvento" NOT LIKE 'Step %'
        AND ("step" IS NULL OR "step" NOT LIKE '%-%')
    `);
    console.log('Eventos a normalizar:', calPre.rows[0].n);

    if (calPre.rows[0].n > 0) {
      const calUpd = await pool.query(`
        UPDATE "CALENDARIO"
        SET "step" = "nombreEvento",
            "_updatedDate" = NOW()
        WHERE "tipo" = 'CLUB'
          AND "nombreEvento" LIKE '% - Step %'
          AND "nombreEvento" NOT LIKE 'Step %'
          AND ("step" IS NULL OR "step" NOT LIKE '%-%')
      `);
      console.log('CALENDARIO filas actualizadas:', calUpd.rowCount);
    }

    // ─── ACADEMICA_BOOKINGS (excluyendo COMPLEMENTARIA) ───────────────
    console.log('\n=== ACADEMICA_BOOKINGS (excl. COMPLEMENTARIA) ===');
    const bkPre = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM "ACADEMICA_BOOKINGS"
      WHERE COALESCE("tipo", '') <> 'COMPLEMENTARIA'
        AND "nombreEvento" LIKE '% - Step %'
        AND "nombreEvento" NOT LIKE 'Step %'
        AND ("step" IS NULL OR "step" NOT LIKE '%-%')
    `);
    console.log('Bookings a normalizar:', bkPre.rows[0].n);

    if (bkPre.rows[0].n > 0) {
      const bkUpd = await pool.query(`
        UPDATE "ACADEMICA_BOOKINGS"
        SET "step" = "nombreEvento",
            "_updatedDate" = NOW()
        WHERE COALESCE("tipo", '') <> 'COMPLEMENTARIA'
          AND "nombreEvento" LIKE '% - Step %'
          AND "nombreEvento" NOT LIKE 'Step %'
          AND ("step" IS NULL OR "step" NOT LIKE '%-%')
      `);
      console.log('ACADEMICA_BOOKINGS filas actualizadas:', bkUpd.rowCount);
    }

    // ─── Verify ───────────────────────────────────────────────────────
    console.log('\n=== Verificación final ===');
    const verCal = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM "CALENDARIO"
      WHERE "tipo" = 'CLUB'
        AND "nombreEvento" LIKE '% - Step %'
        AND "nombreEvento" NOT LIKE 'Step %'
        AND ("step" IS NULL OR "step" NOT LIKE '%-%')
    `);
    console.log('CALENDARIO CLUB pendientes (debe ser 0):', verCal.rows[0].n);

    const verBk = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM "ACADEMICA_BOOKINGS"
      WHERE COALESCE("tipo", '') <> 'COMPLEMENTARIA'
        AND "nombreEvento" LIKE '% - Step %'
        AND "nombreEvento" NOT LIKE 'Step %'
        AND ("step" IS NULL OR "step" NOT LIKE '%-%')
    `);
    console.log('ACADEMICA_BOOKINGS pendientes (debe ser 0):', verBk.rows[0].n);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
