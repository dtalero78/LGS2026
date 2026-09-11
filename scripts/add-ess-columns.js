#!/usr/bin/env node
/**
 * add-ess-columns.js — Agrega ACADEMICA."fechaInicioESS" y PEOPLE."fechaInicioESS"
 * (TIMESTAMPTZ, nullable). Fecha de inicio del nivel paralelo ESS, usada para la
 * auto-promoción a BN1 tras ESS_DURATION_DAYS.
 *
 * Este DDL vivía dentro de resolveStudentFromSession() (request path del panel de
 * estudiante). Como ALTER TABLE toma un lock ACCESS EXCLUSIVE sobre ACADEMICA y
 * PEOPLE, ante un fallo transitorio se reintentaba en cada request y dejaba el
 * cluster clavado al 100% de CPU. El esquema se garantiza acá, no en caliente.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/add-ess-columns.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== ADD fechaInicioESS en ACADEMICA + PEOPLE (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  for (const t of ['ACADEMICA', 'PEOPLE']) {
    const exists = (await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='fechaInicioESS' LIMIT 1`, [t])).rowCount > 0;
    console.log(`${t}.fechaInicioESS existe: ${exists ? 'sí' : 'no'}`);
  }

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear las columnas`); await c.end(); return; }

  for (const t of ['ACADEMICA', 'PEOPLE']) {
    await c.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "fechaInicioESS" TIMESTAMPTZ`);
    const n = (await c.query(`SELECT COUNT(*)::int total, COUNT("fechaInicioESS")::int con_fecha FROM "${t}"`)).rows[0];
    console.log(`🟢 ${t} lista. Filas: ${n.total} · con fechaInicioESS: ${n.con_fecha}`);
  }
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
