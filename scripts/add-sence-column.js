#!/usr/bin/env node
/**
 * add-sence-column.js — Agrega la columna "sence" (BOOLEAN, default false) a
 * PEOPLE y ACADEMICA.
 *
 * SENCE (Servicio Nacional de Capacitación y Empleo, Chile): marca a un titular
 * que toma el programa vía SENCE. Se captura en Crear Contrato con la casilla
 * "Usuario SENCE" (solo habilitada cuando el titular es beneficiario). Queda en
 * true en las filas PEOPLE del titular y su beneficiario, y se propaga a
 * ACADEMICA cuando se crea la ficha (al aprobar el beneficiario).
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/add-sence-column.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== ADD PEOPLE.sence + ACADEMICA.sence (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  for (const table of ['PEOPLE', 'ACADEMICA']) {
    const exists = (await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='sence' LIMIT 1`, [table])).rowCount > 0;
    console.log(`${table}.sence existe: ${exists ? 'sí' : 'no'}`);
  }

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear las columnas`); await c.end(); return; }

  await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "sence" BOOLEAN DEFAULT false`);
  await c.query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "sence" BOOLEAN DEFAULT false`);

  const p = (await c.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE "sence"=true)::int sence FROM "PEOPLE"`)).rows[0];
  const a = (await c.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE "sence"=true)::int sence FROM "ACADEMICA"`)).rows[0];
  console.log(`🟢 Columnas listas. PEOPLE: ${p.total} (sence=true: ${p.sence}) · ACADEMICA: ${a.total} (sence=true: ${a.sence})`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
