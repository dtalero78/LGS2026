#!/usr/bin/env node
/**
 * create-ejercicios-interactivos-table.js — Fase 2 del Material Interactivo.
 *
 * Tabla `EJERCICIOS_INTERACTIVOS`: un set de ejercicios de PRÁCTICA (auto-gradables)
 * por (nivel, step), generado por IA (OpenAI) desde NIVELES.contenido y cacheado
 * para reutilizarlo entre estudiantes. Solo práctica — NO afecta step/bookings.
 *
 * Tipos de pregunta (auto-gradables, sin IA para calificar):
 *   - multiple_choice: { tipo, enunciado, opciones:[...], respuestaCorrecta:index }
 *   - true_false:      { tipo, enunciado, respuestaCorrecta:boolean }
 *   - fill_blank:      { tipo, enunciado (con "___"), respuestaCorrecta:string, aceptadas?:[...] }
 *
 * Idempotente (CREATE TABLE IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/create-ejercicios-interactivos-table.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== EJERCICIOS_INTERACTIVOS (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(`SELECT to_regclass('"EJERCICIOS_INTERACTIVOS"') IS NOT NULL AS e`)).rows[0].e;
  console.log(`Tabla existe: ${exists ? 'sí' : 'no'}`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply`); await c.end(); return; }

  await c.query(`
    CREATE TABLE IF NOT EXISTS "EJERCICIOS_INTERACTIVOS" (
      "_id"          TEXT PRIMARY KEY,
      "nivel"        VARCHAR(20) NOT NULL,
      "step"         VARCHAR(60) NOT NULL,
      "preguntas"    JSONB NOT NULL DEFAULT '[]'::jsonb,
      "generatedBy"  VARCHAR(120),
      "_createdDate" TIMESTAMPTZ DEFAULT NOW(),
      "_updatedDate" TIMESTAMPTZ DEFAULT NOW()
    )`);
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_ejercicios_nivel_step" ON "EJERCICIOS_INTERACTIVOS" ("nivel","step")`);

  const n = (await c.query(`SELECT COUNT(*)::int total FROM "EJERCICIOS_INTERACTIVOS"`)).rows[0];
  console.log(`🟢 Tabla + índice listos. Filas: ${n.total}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
