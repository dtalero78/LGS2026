/**
 * create-pagos-ajustes.js
 *
 * Crea la tabla PAGOS_AJUSTES: auditoría inmutable (solo INSERT) de cada ajuste
 * hecho desde Recaudos › Gestión › Ajustes a una inscripción, pago o factura YA
 * VALIDADOS. Guarda el antes/después del pago y el "Saldo a la Fecha" del
 * contrato antes y después del recálculo.
 *
 * Idempotente (CREATE TABLE / INDEX IF NOT EXISTS). Dry-run por defecto.
 *   node scripts/create-pagos-ajustes.js           (muestra el SQL)
 *   node scripts/create-pagos-ajustes.js --apply   (lo ejecuta)
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');

const SQL = `
CREATE TABLE IF NOT EXISTS "PAGOS_AJUSTES" (
  "_id"            VARCHAR(64) PRIMARY KEY,
  "pagoId"         VARCHAR(64) NOT NULL,
  "idPeople"       VARCHAR(64),
  "contrato"       VARCHAR(50),
  "numCuota"       INTEGER,
  "tipo"           VARCHAR(20) NOT NULL,          -- INSCRIPCION | PAGO | FACTURA
  "antes"          JSONB NOT NULL,                -- campos ajustados, valor previo
  "despues"        JSONB NOT NULL,                -- campos ajustados, valor nuevo
  "motivo"         TEXT NOT NULL,
  "saldoAntes"     VARCHAR(50),                   -- FINANCIEROS.saldo antes
  "saldoDespues"   VARCHAR(50),                   -- FINANCIEROS.saldo después del recálculo
  "usuarioEmail"   VARCHAR(255),
  "usuarioNombre"  VARCHAR(255),
  "usuarioRol"     VARCHAR(50),
  "_createdDate"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_pagos_ajustes_idpeople" ON "PAGOS_AJUSTES" ("idPeople");
CREATE INDEX IF NOT EXISTS "idx_pagos_ajustes_created"  ON "PAGOS_AJUSTES" ("_createdDate" DESC);
`;

(async () => {
  if (!process.argv.includes('--apply')) {
    console.log(SQL);
    console.log('(dry-run — use --apply para ejecutar)');
    return;
  }
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query(SQL);
    const n = await c.query(`SELECT COUNT(*)::int AS n FROM "PAGOS_AJUSTES"`);
    console.log(`✅ PAGOS_AJUSTES lista (${n.rows[0].n} registros).`);
  } finally {
    await c.end();
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
