/**
 * create-planes-tipos.js — catálogo de planes y tipos de plan (Libro de Producción › Planes).
 *
 *  - PLANES_TIPOS: por PAÍS, cada plan (número de cuotas, p. ej. 13) puede tener varios
 *    tipos (13-A, 13-B…), con sus montos de referencia. UNIQUE (pais, cuotas, nombre).
 *    Más adelante se elegirá desde Crear Contrato.
 *  - PEOPLE."tipoPlanId" (solo se usa en el TITULAR): tipo de plan elegido para el contrato.
 *
 * Idempotente (IF NOT EXISTS). Dry-run por defecto: imprime el SQL; --apply lo ejecuta.
 * Uso: node scripts/create-planes-tipos.js [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

const SQL = [
  `CREATE TABLE IF NOT EXISTS "PLANES_TIPOS" (
     "_id"          VARCHAR(64) PRIMARY KEY,
     "pais"         VARCHAR(50) NOT NULL,
     "cuotas"       INTEGER NOT NULL CHECK ("cuotas" >= 1),
     "nombre"       VARCHAR(100) NOT NULL,
     "inscripcion"  NUMERIC(14,2),
     "valorCuota"   NUMERIC(14,2),
     "total"        NUMERIC(14,2),
     "descripcion"  TEXT,
     "activo"       BOOLEAN NOT NULL DEFAULT true,
     "creadoPor"    VARCHAR(150),
     "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "_updatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT "planes_tipos_uq" UNIQUE ("pais", "cuotas", "nombre")
   )`,
  `ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "tipoPlanId" VARCHAR(64)`,
];

(async () => {
  if (!APPLY) {
    console.log('DRY-RUN — SQL que se ejecutaría con --apply:\n');
    SQL.forEach((s) => console.log(s + ';\n'));
    return;
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    for (const s of SQL) { await c.query(s); console.log('✔', s.split('\n')[0]); }
    console.log('PLANES_TIPOS lista · PEOPLE.tipoPlanId lista.');
  } finally { await c.end(); }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
