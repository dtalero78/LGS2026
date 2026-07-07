#!/usr/bin/env node
/**
 * create-ejercicios-intentos-table.js — Fase 2 del Material Interactivo.
 *
 * Tabla `EJERCICIOS_INTENTOS`: registro POR ESTUDIANTE de qué step ha
 * completado su ejercicio de práctica. Regla de negocio: UN solo intento por
 * step (índice único por studentId+nivel+step). Permite mostrar al estudiante
 * cuántos ejercicios ha generado y cuántos le quedan (hasta su step actual).
 *
 *   - studentId: ACADEMICA._id del estudiante (academicaId)
 *   - numeroId:  documento (referencia cruzada, tolera duplicados en PEOPLE)
 *   - nivel/step: del step evaluado
 *   - stepNum:   número global del step (1..45) para acotar "hasta su step actual"
 *   - porcentaje/aprobado: resultado del único intento
 *
 * Idempotente (CREATE TABLE IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/create-ejercicios-intentos-table.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== EJERCICIOS_INTENTOS (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(`SELECT to_regclass('"EJERCICIOS_INTENTOS"') IS NOT NULL AS e`)).rows[0].e;
  console.log(`Tabla existe: ${exists ? 'sí' : 'no'}`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply`); await c.end(); return; }

  await c.query(`
    CREATE TABLE IF NOT EXISTS "EJERCICIOS_INTENTOS" (
      "_id"          TEXT PRIMARY KEY,
      "studentId"    TEXT NOT NULL,
      "numeroId"     VARCHAR(60),
      "nivel"        VARCHAR(20) NOT NULL,
      "step"         VARCHAR(60) NOT NULL,
      "stepNum"      INTEGER,
      "porcentaje"   INTEGER,
      "aprobado"     BOOLEAN,
      "_createdDate" TIMESTAMPTZ DEFAULT NOW()
    )`);
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_ejercicios_intentos_student_step" ON "EJERCICIOS_INTENTOS" ("studentId","nivel","step")`);
  await c.query(`CREATE INDEX IF NOT EXISTS "idx_ejercicios_intentos_student" ON "EJERCICIOS_INTENTOS" ("studentId")`);

  const n = (await c.query(`SELECT COUNT(*)::int total FROM "EJERCICIOS_INTENTOS"`)).rows[0];
  console.log(`🟢 Tabla + índices listos. Filas: ${n.total}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
