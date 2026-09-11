#!/usr/bin/env node
/**
 * add-esplanta-column.js — Agrega ADVISORS.esPlanta (BOOLEAN, default false).
 *
 * Atributo estable del advisor: si es "de planta", en Control de Horas la casilla
 * "Advisor Planta" arranca marcada y Total Hours NO descuenta la media hora por
 * sesión conducida sin asistentes. No toca datos históricos de eventos.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/add-esplanta-column.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== ADD ADVISORS.esPlanta (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='ADVISORS' AND column_name='esPlanta' LIMIT 1`)).rowCount > 0;
  console.log(`Columna esPlanta existe: ${exists ? 'sí' : 'no'}`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear la columna`); await c.end(); return; }

  await c.query(`ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "esPlanta" BOOLEAN DEFAULT false`);
  const n = (await c.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE "esPlanta"=true)::int planta FROM "ADVISORS"`)).rows[0];
  console.log(`🟢 Columna lista. Advisors: ${n.total} · de planta: ${n.planta}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
