/**
 * Sólo lectura. Cuenta bookings con plataforma NULL desde la fecha en que
 * se introdujo el bug (commit daadaf2, 2026-05-21) — el SELECT de
 * enrollment.service.ts perdió la columna plataforma al refactorizarse
 * para agregar el chequeo de INACTIVO.
 *
 * Reporta totales por origen y por agendadoPorRol.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const total = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM "ACADEMICA_BOOKINGS"
      WHERE ("plataforma" IS NULL OR "plataforma" = '')
        AND "_createdDate" >= '2026-05-21'
    `);
    console.log(`\nBookings con plataforma NULL creados desde 2026-05-21: ${total.rows[0].n}\n`);

    const byRol = await pool.query(`
      SELECT COALESCE("agendadoPorRol", '(NULL)') AS rol, COUNT(*)::int AS n
      FROM "ACADEMICA_BOOKINGS"
      WHERE ("plataforma" IS NULL OR "plataforma" = '')
        AND "_createdDate" >= '2026-05-21'
      GROUP BY "agendadoPorRol"
      ORDER BY n DESC
    `);
    console.log('Distribución por agendadoPorRol:');
    byRol.rows.forEach(r => console.log(`  ${r.rol.padEnd(20)} ${r.n}`));

    const recoverable = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM "ACADEMICA_BOOKINGS" b
      WHERE ("b"."plataforma" IS NULL OR "b"."plataforma" = '')
        AND "b"."_createdDate" >= '2026-05-21'
        AND EXISTS (
          SELECT 1 FROM "PEOPLE" p
          WHERE p."_id" = b."idEstudiante" OR p."_id" = b."studentId"
            OR p."numeroId" = b."numeroId"
        )
    `);
    console.log(`\nRecuperables vía PEOPLE (mismo _id o numeroId): ${recoverable.rows[0].n}`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
