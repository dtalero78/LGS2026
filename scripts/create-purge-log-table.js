// Migración idempotente: crea tabla PURGE_LOG para auditar las purgas
// de contratos de prueba. Cada purga genera 1 fila con snapshot JSONB
// de TODAS las filas borradas + metadata del actor.
//   node scripts/create-purge-log-table.js
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "PURGE_LOG" (
        "_id"              VARCHAR(255) PRIMARY KEY,
        "tipoPurga"        VARCHAR(50)  NOT NULL,            -- 'CONTRATO_PRUEBA' (extensible a otros tipos futuros)
        "contrato"         VARCHAR(50),                       -- número del contrato purgado (PRB-NNNNN-YY)
        "titularId"        VARCHAR(255),                      -- PEOPLE._id del titular borrado (referencia, ya no existe)
        "titularNombre"    VARCHAR(255),                      -- nombre completo del titular para identificar sin abrir el snapshot
        "snapshot"         JSONB NOT NULL,                    -- { people: [...], academica: [...], bookings: [...], financieros: [...], pagos: [...], stepOverrides: [...], complementarias: [...], usuariosRoles: [...] }
        "motivo"           TEXT  NOT NULL,                    -- motivo obligatorio del admin
        "realizadoPor"     VARCHAR(255) NOT NULL,             -- email del admin
        "realizadoPorNombre" VARCHAR(255),
        "ip"               VARCHAR(50),
        "userAgent"        TEXT,
        "filasBorradas"    JSONB,                             -- { people: N, academica: N, ... } conteos rápidos
        "_createdDate"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_purge_log_contrato" ON "PURGE_LOG"("contrato")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_purge_log_actor" ON "PURGE_LOG"("realizadoPor", "_createdDate" DESC)`);
    console.log('✅ Tabla PURGE_LOG creada (o ya existía).');
    const cnt = await pool.query(`SELECT COUNT(*)::int n FROM "PURGE_LOG"`);
    console.log(`   Filas existentes: ${cnt.rows[0].n}`);
  } finally {
    await pool.end();
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
