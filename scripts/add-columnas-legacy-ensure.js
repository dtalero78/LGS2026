#!/usr/bin/env node
/**
 * add-columnas-legacy-ensure.js — Garantiza el esquema que antes se "aseguraba"
 * con DDL dentro del request path (funciones ensure* en repositories/services).
 *
 * Contexto: ese patrón tumbó el cluster el 2026-09-07. ALTER TABLE toma un lock
 * ACCESS EXCLUSIVE sobre la tabla; encolado detrás de una query lenta, bloquea
 * todo el tráfico de esa tabla, y como los ensure* reintentaban ante cualquier
 * fallo, un hipo transitorio se volvía una caída permanente.
 *
 * Las funciones ensure* siguen existiendo (vía lib/ensure-once, ya sin reintento)
 * como red de seguridad para entornos nuevos, pero el esquema de produccion se
 * garantiza ACÁ. Correr este script después de cada deploy que agregue columnas.
 *
 * Idempotente (IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/add-columnas-legacy-ensure.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

const COLUMNAS = [
  ['ACADEMICA', 'pruebainter',            'VARCHAR(10)',  'booking.repository + academic-record'],
  ['ACADEMICA', 'fechaPromocionEspecial', 'TIMESTAMPTZ',  'student.service (auto-promocion 100 dias)'],
  ['ACADEMICA', 'cambioStepHistory',      'JSONB',        'academica.repository (auditoria de step)'],
  ['ACADEMICA', 'checkinicianivel',       'INTEGER',      'academica.repository (Inicializar Nivel)'],
  ['ACADEMICA', 'inicianivel',            'JSONB',        'academica.repository (Inicializar Nivel)'],
];

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();
  console.log(`\n===== ESQUEMA legacy ensure* (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====\n`);

  for (const [tabla, col, tipo, usadaPor] of COLUMNAS) {
    const existe = (await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
      [tabla, col])).rowCount > 0;
    console.log(`${existe ? '🟢' : '🔴'} ${tabla}.${col} (${tipo}) — ${usadaPor}`);
    if (APPLY && !existe) {
      await c.query(`ALTER TABLE "${tabla}" ADD COLUMN IF NOT EXISTS "${col}" ${tipo}`);
      console.log(`   ↳ creada`);
    }
  }

  const tablaJump = (await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name='JUMP_EVALUATIONS' LIMIT 1`)).rowCount > 0;
  console.log(`${tablaJump ? '🟢' : '🔴'} tabla JUMP_EVALUATIONS — jump-evaluation.repository`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear lo que falte\n`); await c.end(); return; }

  if (!tablaJump) {
    await c.query(`
      CREATE TABLE IF NOT EXISTS "JUMP_EVALUATIONS" (
        "_id" VARCHAR(64) PRIMARY KEY,
        "studentId" VARCHAR(64) NOT NULL,
        "numeroId" VARCHAR(64),
        "nivel" VARCHAR(20) NOT NULL,
        "jumpStep" VARCHAR(40) NOT NULL,
        "plataforma" VARCHAR(50),
        "status" VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
        "score" INTEGER,
        "recomendacion" VARCHAR(20),
        "criterios" JSONB,
        "fortalezas" JSONB,
        "debilidades" JSONB,
        "resumen" TEXT,
        "transcript" JSONB,
        "durationSec" INTEGER,
        "reviewStatus" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        "reviewedBy" VARCHAR(255),
        "reviewedAt" TIMESTAMPTZ,
        "reviewNota" TEXT,
        "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "_updatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    console.log(`   ↳ creada`);
  }
  await c.query(`CREATE INDEX IF NOT EXISTS "idx_jumpeval_student" ON "JUMP_EVALUATIONS" ("studentId", "_createdDate" DESC)`);
  await c.query(`CREATE INDEX IF NOT EXISTS "idx_jumpeval_review"  ON "JUMP_EVALUATIONS" ("reviewStatus", "_createdDate" DESC)`);

  console.log(`\n🟢 Esquema al día.\n`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
