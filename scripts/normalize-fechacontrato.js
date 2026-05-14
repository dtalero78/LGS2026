/**
 * One-time normalization + DDL: convert fechaContrato (PEOPLE + ACADEMICA)
 * from timestamptz to plain DATE.
 *
 * Why: fechaContrato is the signing date — never modified after creation, only
 * shown in the UI. Mixing timestamptz + a server in UTC + clients in various
 * timezones causes the date to drift by ±1 day in the displayed value depending
 * on where the user lives. A pure DATE column eliminates that drift entirely.
 *
 * Idempotent in two steps:
 *   1. Round values to midnight America/Bogota (no-op for rows already at 00:00 -05)
 *   2. ALTER COLUMN to DATE (no-op if already DATE)
 *
 * Applies to BOTH tables: PEOPLE.fechaContrato and ACADEMICA.fechaContrato.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const TABLES = ['PEOPLE', 'ACADEMICA'];

async function getType(pool, table) {
  const r = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name = $1 AND column_name = 'fechaContrato'`,
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

      // Step 1: normalize values to midnight Bogotá (only rows that need it)
      const pending = await pool.query(
        `SELECT COUNT(*)::int AS n FROM "${table}"
         WHERE "fechaContrato" IS NOT NULL
           AND ("fechaContrato" AT TIME ZONE 'America/Bogota')
               <> date_trunc('day', "fechaContrato" AT TIME ZONE 'America/Bogota')`
      );
      console.log('Filas a normalizar:', pending.rows[0].n);

      if (pending.rows[0].n > 0) {
        const upd = await pool.query(
          `UPDATE "${table}"
           SET "fechaContrato" = (date_trunc('day', "fechaContrato" AT TIME ZONE 'America/Bogota')
                                  AT TIME ZONE 'America/Bogota'),
               "_updatedDate" = NOW()
           WHERE "fechaContrato" IS NOT NULL
             AND ("fechaContrato" AT TIME ZONE 'America/Bogota')
                 <> date_trunc('day', "fechaContrato" AT TIME ZONE 'America/Bogota')`
        );
        console.log('Filas normalizadas:', upd.rowCount);
      }

      // Step 2: alter type to DATE
      console.log('Convirtiendo a DATE…');
      await pool.query(
        `ALTER TABLE "${table}"
         ALTER COLUMN "fechaContrato" TYPE DATE
         USING ("fechaContrato" AT TIME ZONE 'America/Bogota')::date`
      );
      const after = await getType(pool, table);
      console.log('Tipo nuevo:', after);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
