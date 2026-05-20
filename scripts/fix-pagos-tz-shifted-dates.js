/**
 * Corrige fechaPago / fechaValidacion en PAGOS_TITULARES que sufrieron
 * corrimiento TZ (datos creados antes del fix de fechas TZ-local).
 *
 * Regla:
 *   "creado_local_co" = (_createdDate AT TIME ZONE 'America/Bogota')::date
 *   Si fechaPago se desvía 1 o 2 días de creado_local_co → la corrige a
 *   creado_local_co. Mismo para fechaValidacion si se creó como auto-
 *   validado (es decir, fechaPago y fechaValidacion eran iguales antes
 *   de la corrección).
 *
 * Sólo afecta registros con _createdDate < '2026-05-21' (corte donde se
 * desplegó el fix de TZ-local). Idempotente.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply'); // sin flag → dry run

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // Detecta candidatos: fechaPago > creado_local_co por 1 o 2 días.
    const candidates = await pool.query(`
      WITH base AS (
        SELECT
          pt."_id",
          pt."numCuota",
          pt."fechaPago",
          pt."fechaValidacion",
          (pt."_createdDate" AT TIME ZONE 'America/Bogota')::date AS creado_local_co,
          pt."_createdDate"
        FROM "PAGOS_TITULARES" pt
        WHERE pt."_createdDate" < '2026-05-21'
      )
      SELECT *,
             (pt_diff)::int AS diff_dias
      FROM (
        SELECT b.*,
               (b."fechaPago" - b.creado_local_co) AS pt_diff
        FROM base b
        WHERE b."fechaPago" IS NOT NULL
          AND b."fechaPago" <> b.creado_local_co
      ) x
      WHERE pt_diff BETWEEN 1 AND 2
      ORDER BY "_createdDate" DESC
    `);

    if (candidates.rowCount === 0) {
      console.log('OK — no se detectaron registros con corrimiento TZ');
      return;
    }

    console.log(`Detectados ${candidates.rowCount} pagos con fechaPago desplazada:`);
    for (const r of candidates.rows) {
      const valShift = r.fechaValidacion ? (
        // Si fechaValidacion coincidía con fechaPago (auto-validación de cuota#0)
        // o si también está desplazada por el mismo offset → la corregimos también
        new Date(r.fechaValidacion).getTime() === new Date(r.fechaPago).getTime() ? r.diff_dias : null
      ) : null;
      console.log(
        `  ${r._id.slice(0,16)}  cuota=${r.numCuota}  ` +
        `fechaPago=${r.fechaPago.toISOString().slice(0,10)} → ${r.creado_local_co.toISOString().slice(0,10)}` +
        (valShift ? `  · fechaVal también -${valShift}d` : '')
      );
    }

    if (!APPLY) {
      console.log(`\nDry-run (sin escribir). Para aplicar: node scripts/fix-pagos-tz-shifted-dates.js --apply`);
      return;
    }

    // Apply
    let updated = 0;
    for (const r of candidates.rows) {
      const newFechaPago = r.creado_local_co.toISOString().slice(0, 10);
      // Si fechaValidacion estaba igual a fechaPago (típico de cuota #0
      // auto-validada), también corregimos fechaValidacion.
      const equalDates = r.fechaValidacion &&
        new Date(r.fechaValidacion).getTime() === new Date(r.fechaPago).getTime();

      if (equalDates) {
        await pool.query(
          `UPDATE "PAGOS_TITULARES"
           SET "fechaPago" = $2::date,
               "fechaValidacion" = $2::date,
               "_updatedDate" = NOW()
           WHERE "_id" = $1`,
          [r._id, newFechaPago]
        );
      } else {
        await pool.query(
          `UPDATE "PAGOS_TITULARES"
           SET "fechaPago" = $2::date, "_updatedDate" = NOW()
           WHERE "_id" = $1`,
          [r._id, newFechaPago]
        );
      }
      updated++;
    }
    console.log(`\nOK — ${updated} registros corregidos`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
