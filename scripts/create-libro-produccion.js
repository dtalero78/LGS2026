/**
 * create-libro-produccion.js — esquema del "Libro de Producción" (Aprobación › Libro de Producción).
 *
 *  - PEOPLE (solo se usan en el TITULAR): escalera comercial del día de la matrícula
 *    (fullExecutive, jefeGrupo, gerente, gerenteDivision, salesManager, filial),
 *    origenMatricula, y las casillas manuales suscripcionPago / prixus.
 *  - VIGENCIAS_COMERCIALES: mes comercial ("Vigencias"), una por año+mes, igual para
 *    todos los países. inicio/fin son fecha-hora SIN zona (p. ej. 2026-09-28 09:00):
 *    el corte se interpreta en la hora local del país de cada contrato.
 *  - Índice parcial por fechaCreacion de los titulares (la vista filtra por ahí).
 *
 * Idempotente (IF NOT EXISTS). Dry-run por defecto: imprime el SQL; --apply lo ejecuta.
 * Uso: node scripts/create-libro-produccion.js [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

const SQL = [
  `ALTER TABLE "PEOPLE"
     ADD COLUMN IF NOT EXISTS "fullExecutive"   VARCHAR(150),
     ADD COLUMN IF NOT EXISTS "jefeGrupo"       VARCHAR(150),
     ADD COLUMN IF NOT EXISTS "gerente"         VARCHAR(150),
     ADD COLUMN IF NOT EXISTS "gerenteDivision" VARCHAR(150),
     ADD COLUMN IF NOT EXISTS "salesManager"    VARCHAR(150),
     ADD COLUMN IF NOT EXISTS "filial"          VARCHAR(150),
     ADD COLUMN IF NOT EXISTS "origenMatricula" VARCHAR(200),
     ADD COLUMN IF NOT EXISTS "suscripcionPago" BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN IF NOT EXISTS "prixus"          BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS "VIGENCIAS_COMERCIALES" (
     "_id"          VARCHAR(64) PRIMARY KEY,
     "anio"         INTEGER NOT NULL,
     "mes"          INTEGER NOT NULL CHECK ("mes" BETWEEN 1 AND 12),
     "inicio"       TIMESTAMP NOT NULL,
     "fin"          TIMESTAMP NOT NULL,
     "creadoPor"    VARCHAR(150),
     "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "_updatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT "vigencias_anio_mes_uq" UNIQUE ("anio", "mes"),
     CONSTRAINT "vigencias_rango_ck" CHECK ("fin" > "inicio")
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_people_titular_fechacreacion"
     ON "PEOPLE" ("fechaCreacion") WHERE "tipoUsuario" = 'TITULAR'`,
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
    const cols = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='PEOPLE'
      AND column_name IN ('fullExecutive','jefeGrupo','gerente','gerenteDivision','salesManager','filial','origenMatricula','suscripcionPago','prixus')`)).rows;
    console.log(`PEOPLE: ${cols.length}/9 columnas nuevas presentes · VIGENCIAS_COMERCIALES lista.`);
  } finally { await c.end(); }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
