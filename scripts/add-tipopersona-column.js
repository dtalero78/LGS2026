#!/usr/bin/env node
/**
 * add-tipopersona-column.js — Agrega PEOPLE."tipoPersona" (VARCHAR(20), nullable).
 * Tipo de persona del titular: 'Persona Natural' | 'Empresa'. La Franquicia SENCE
 * (Chile) solo se activa para titulares Empresa.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/add-tipopersona-column.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== ADD PEOPLE.tipoPersona (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='PEOPLE' AND column_name='tipoPersona' LIMIT 1`)).rowCount > 0;
  console.log(`Columna tipoPersona existe: ${exists ? 'sí' : 'no'}`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear la columna`); await c.end(); return; }

  await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "tipoPersona" VARCHAR(20)`);
  const n = (await c.query(`SELECT COUNT(*)::int total, COUNT("tipoPersona")::int con_valor FROM "PEOPLE"`)).rows[0];
  console.log(`🟢 Columna lista. PEOPLE: ${n.total} · con tipoPersona: ${n.con_valor}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
