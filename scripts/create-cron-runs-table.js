/**
 * Migración Cron Health-Check:
 *   CREATE TABLE CRON_RUNS — historial de cada ejecución de cron jobs.
 *
 * Usada por:
 *   - Helper recordCronRun() en src/lib/cron-runs.ts (insert + update por ejecución)
 *   - Endpoint GET /api/cron/health-check (lee última ejecución por cron_name)
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
 *
 * Política de retención: sin TTL automático. Cada ejecución del cron-worker
 * agrega 1 fila por cron (2 crones/día = ~730 filas/año). Si crece mucho,
 * se puede agregar un job de limpieza que borre filas > 90 días.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    console.log('▶ CREATE CRON_RUNS…');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CRON_RUNS" (
        "_id"            VARCHAR(50)  PRIMARY KEY,
        "cronName"       VARCHAR(50)  NOT NULL,
        "startedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "finishedAt"     TIMESTAMPTZ,
        "status"         VARCHAR(20)  NOT NULL DEFAULT 'running',
        "processedCount" INTEGER      DEFAULT 0,
        "successCount"   INTEGER      DEFAULT 0,
        "failedCount"    INTEGER      DEFAULT 0,
        "errorMessage"   TEXT,
        "metadata"       JSONB
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_cron_runs_name_started" ON "CRON_RUNS" ("cronName", "startedAt" DESC)`);

    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name='CRON_RUNS' ORDER BY ordinal_position`
    );
    console.log(`\n✅ CRON_RUNS (${cols.rows.length} columnas):`);
    cols.rows.forEach(r => console.log(`   ${r.column_name}: ${r.data_type}`));
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
