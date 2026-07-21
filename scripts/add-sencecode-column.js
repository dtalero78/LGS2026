#!/usr/bin/env node
/**
 * add-sencecode-column.js — Agrega ACADEMICA."senceCode" (VARCHAR, alfanumérico,
 * nullable). Código SENCE del estudiante (complementa la marca booleana `sence`).
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/add-sencecode-column.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== ADD ACADEMICA.senceCode (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='ACADEMICA' AND column_name='senceCode' LIMIT 1`)).rowCount > 0;
  console.log(`Columna senceCode existe: ${exists ? 'sí' : 'no'}`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear la columna`); await c.end(); return; }

  await c.query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "senceCode" VARCHAR(50)`);
  const n = (await c.query(`SELECT COUNT(*)::int total, COUNT("senceCode")::int con_code FROM "ACADEMICA"`)).rows[0];
  console.log(`🟢 Columna lista. ACADEMICA: ${n.total} · con senceCode: ${n.con_code}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
