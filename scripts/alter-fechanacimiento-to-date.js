/**
 * One-time DDL: convert fechaNacimiento from timestamptz to DATE in
 * PEOPLE and ACADEMICA. ADVISORS is already DATE.
 *
 * All existing values are stored at exactly 00:00:00 UTC (no Bogotá offset
 * like finalContrato had), so the cast `USING "fechaNacimiento"::date`
 * preserves the exact date as visible today — no normalization needed.
 *
 * Idempotent: skips a table when its column is already DATE.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const TABLES = ['PEOPLE', 'ACADEMICA'];

async function getType(pool, table) {
  const r = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name = $1 AND column_name = 'fechaNacimiento'`,
    [table]
  );
  return r.rows[0]?.data_type || null;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const table of TABLES) {
      console.log(`\n=== ${table} ===`);
      const type = await getType(pool, table);
      console.log('Tipo actual:', type);

      if (!type) {
        console.log('Columna no existe. Saltando.');
        continue;
      }
      if (type === 'date') {
        console.log('Ya es DATE. Nada por hacer.');
        continue;
      }

      // Pre-check: confirmar que TODAS las filas con valor están a 00:00 UTC
      // (si hubiera filas con hora distinta de 0 UTC, el cast podría perder info)
      const check = await pool.query(
        `SELECT COUNT(*)::int AS off_midnight
         FROM "${table}"
         WHERE "fechaNacimiento" IS NOT NULL
           AND EXTRACT(HOUR FROM "fechaNacimiento") <> 0`
      );
      if (check.rows[0].off_midnight > 0) {
        console.warn(
          `⚠️ ${check.rows[0].off_midnight} filas con hora distinta de 00:00 UTC — el cast directo podría cambiar la fecha. Abortando ${table}.`
        );
        continue;
      }

      console.log('Convirtiendo a DATE (cast UTC directo)…');
      await pool.query(
        `ALTER TABLE "${table}"
         ALTER COLUMN "fechaNacimiento" TYPE DATE
         USING "fechaNacimiento"::date`
      );
      console.log('Tipo nuevo:', await getType(pool, table));
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
