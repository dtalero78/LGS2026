/**
 * Backfill de PEOPLE.estado para registros aprobados y vigentes con estado=NULL.
 *
 * Reglas:
 *   - aprobacion='Aprobado' AND finalContrato > hoy AND estado IS NULL
 *     - estadoInactivo=true   → SKIP (inconsistencia para revisión manual)
 *     - extensionCount>0      → estado='CON EXTENSION'
 *     - sino                  → estado='ACTIVA'
 *
 * Modos:
 *   node scripts/backfill-estado-activa.js          → dry-run
 *   node scripts/backfill-estado-activa.js --apply  → ejecuta
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

    // Preview por grupo
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE ("estadoInactivo" IS NULL OR "estadoInactivo" = false)
            AND (COALESCE("extensionCount", 0) = 0)
        )::int AS grupo_a_activa,
        COUNT(*) FILTER (
          WHERE ("estadoInactivo" IS NULL OR "estadoInactivo" = false)
            AND COALESCE("extensionCount", 0) > 0
        )::int AS grupo_b_con_extension,
        COUNT(*) FILTER (
          WHERE "estadoInactivo" = true
        )::int AS grupo_c_skip
      FROM "PEOPLE"
      WHERE "aprobacion" = 'Aprobado'
        AND "finalContrato" IS NOT NULL
        AND "finalContrato" > CURRENT_DATE
        AND "estado" IS NULL
    `);
    const s = stats.rows[0];
    console.log(`Grupo A → ACTIVA:           ${s.grupo_a_activa}`);
    console.log(`Grupo B → CON EXTENSION:    ${s.grupo_b_con_extension}`);
    console.log(`Grupo C → SKIP (revisión):  ${s.grupo_c_skip}`);

    if (APPLY) {
      // UPDATE grupo A → ACTIVA
      const updA = await pool.query(`
        UPDATE "PEOPLE"
        SET "estado" = 'ACTIVA', "_updatedDate" = NOW()
        WHERE "aprobacion" = 'Aprobado'
          AND "finalContrato" IS NOT NULL
          AND "finalContrato" > CURRENT_DATE
          AND "estado" IS NULL
          AND ("estadoInactivo" IS NULL OR "estadoInactivo" = false)
          AND COALESCE("extensionCount", 0) = 0
      `);
      console.log(`\n✓ Grupo A actualizados a ACTIVA: ${updA.rowCount}`);

      // UPDATE grupo B → CON EXTENSION
      const updB = await pool.query(`
        UPDATE "PEOPLE"
        SET "estado" = 'CON EXTENSION', "_updatedDate" = NOW()
        WHERE "aprobacion" = 'Aprobado'
          AND "finalContrato" IS NOT NULL
          AND "finalContrato" > CURRENT_DATE
          AND "estado" IS NULL
          AND ("estadoInactivo" IS NULL OR "estadoInactivo" = false)
          AND COALESCE("extensionCount", 0) > 0
      `);
      console.log(`✓ Grupo B actualizados a CON EXTENSION: ${updB.rowCount}`);
    } else {
      console.log(`\nDry-run. Para aplicar:\n  node scripts/backfill-estado-activa.js --apply`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
