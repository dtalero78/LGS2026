/**
 * One-time DDL: add PEOPLE.suspenddata (JSONB) and PEOPLE.suspendcount (INTEGER)
 * columns to track administrative suspensions from the "Estado del Contrato"
 * toggle and the per-beneficiary "Inactivar" button in /person/[id].
 *
 * suspenddata: stores ONLY the LAST suspension event (object, not array):
 *   {
 *     accion: 'INACTIVACION' | 'REACTIVACION',
 *     motivo: string (required),
 *     fecha: ISO timestamp,
 *     realizadoPor: email of the admin,
 *     realizadoPorNombre: display name of the admin (optional)
 *   }
 *
 * suspendcount: counter incremented ONLY on INACTIVACION (not on REACTIVACION).
 *   Used for audit / risk profiling. NOT used as the gating condition for the
 *   yellow "SUSPENDIDA" badge — that gating is based on suspenddata.accion.
 *
 * The yellow badge is shown when:
 *   estadoInactivo = true AND suspenddata.accion = 'INACTIVACION'
 * This positive rule replaces the previous blacklist-based isAdminSuspended()
 * and is robust against future paths that set estadoInactivo=true for other
 * reasons (cron expiry, OnHold, special-nivel block, bulk bloqueo, etc.).
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const before = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name='PEOPLE' AND column_name IN ('suspenddata','suspendcount')
       ORDER BY column_name`
    );
    console.log('Estado previo:');
    if (before.rows.length === 0) console.log('  (ninguna columna existe)');
    else before.rows.forEach(r => console.log(`  ${r.column_name}: EXISTE (${r.data_type})`));

    await pool.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "suspenddata" JSONB`);
    await pool.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "suspendcount" INTEGER DEFAULT 0`);

    // Backfill: set suspendcount=0 only where NULL (defensive — DEFAULT 0
    // should handle new rows, but legacy ALTERs sometimes leave NULL).
    const backfill = await pool.query(
      `UPDATE "PEOPLE" SET "suspendcount" = 0 WHERE "suspendcount" IS NULL`
    );
    if (backfill.rowCount > 0) console.log(`Backfill suspendcount=0 en ${backfill.rowCount} filas con NULL.`);

    const after = await pool.query(
      `SELECT column_name, data_type, column_default FROM information_schema.columns
       WHERE table_name='PEOPLE' AND column_name IN ('suspenddata','suspendcount')
       ORDER BY column_name`
    );
    console.log('Estado final:');
    after.rows.forEach(r => console.log(`  ${r.column_name}: OK (${r.data_type}${r.column_default ? `, default ${r.column_default}` : ''})`));
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
