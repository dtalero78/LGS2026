#!/usr/bin/env node
/**
 * backfill-asesor-asignado.js — Puebla PEOPLE.asesorAsignado (lgs-db) con el
 * NOMBRE del asesor comercial, resolviendo el email de PEOPLE.asesor.
 *
 * Fuente de nombres (en orden):
 *   1. CRM (lgs-crm-db) tabla "User": email → firstName + lastName.
 *   2. Fallback: USUARIOS_ROLES (lgs-db): email → nombre + apellido.
 *   3. Si PEOPLE.asesor NO es email (ya es un nombre) → se usa tal cual.
 *
 * SOBRESCRIBE asesorAsignado (decisión del usuario). Idempotente (re-correr da
 * el mismo resultado). Dry-run por defecto; escribe con --apply.
 *
 * Genera:
 *   docs/asesor-asignado-ya-nombre.csv   → titulares cuyo `asesor` ya era un nombre
 *   docs/asesor-asignado-sin-resolver.csv → emails no hallados en CRM ni USUARIOS_ROLES
 *
 * REQUISITOS: DATABASE_URL en .env.local (lgs-db) + CRM_URI en el entorno
 *   (export CRM_URI=$(doctl databases connection <lgs-crm-db-id> --format URI --no-header))
 *   y la IP whitelisteada en AMBOS clusters.
 *
 * USO: node scripts/backfill-asesor-asignado.js [--apply]
 */
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const mk = uri => new Client({ connectionString: uri.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const csv = a => a.map(x => { const s = String(x ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';');
const nombreCompleto = t => `${t.primerNombre || ''} ${t.primerApellido || ''}`.trim();

(async () => {
  if (!process.env.CRM_URI) { console.error('Falta CRM_URI en el entorno (doctl databases connection ...).'); process.exit(1); }
  console.log(`\n===== BACKFILL asesorAsignado (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);
  const crm = mk(process.env.CRM_URI), lgs = mk(process.env.DATABASE_URL);
  await crm.connect(); await lgs.connect();

  const crmMap = new Map((await crm.query(
    `SELECT LOWER(TRIM("email")) email, TRIM(CONCAT_WS(' ', "firstName","lastName")) nombre FROM "User" WHERE "email" IS NOT NULL`
  )).rows.filter(u => u.email && u.nombre).map(u => [u.email, u.nombre]));

  const urMap = new Map((await lgs.query(
    `SELECT LOWER(TRIM("email")) email, TRIM(CONCAT_WS(' ', "nombre","apellido")) nombre FROM "USUARIOS_ROLES" WHERE "email" IS NOT NULL`
  )).rows.filter(u => u.email && u.nombre).map(u => [u.email, u.nombre]));

  console.log(`CRM Users: ${crmMap.size} · USUARIOS_ROLES: ${urMap.size}`);

  const tit = (await lgs.query(
    `SELECT "_id","contrato","primerNombre","primerApellido","asesor" FROM "PEOPLE" WHERE "tipoUsuario"='TITULAR' AND COALESCE("asesor",'')<>''`
  )).rows;

  const updates = [], yaNombre = [], sinResolver = [];
  for (const t of tit) {
    const raw = (t.asesor || '').trim();
    if (raw.includes('@')) {
      const k = raw.toLowerCase();
      const nombre = crmMap.get(k) || urMap.get(k) || null;
      if (nombre) updates.push({ _id: t._id, nombre, fuente: crmMap.get(k) ? 'CRM' : 'USUARIOS_ROLES' });
      else sinResolver.push(t);
    } else {
      updates.push({ _id: t._id, nombre: raw, fuente: 'ya_nombre' });
      yaNombre.push(t);
    }
  }

  const by = {}; updates.forEach(u => by[u.fuente] = (by[u.fuente] || 0) + 1);
  console.log(`\nTitulares con asesor: ${tit.length}`);
  console.log(`A actualizar: ${updates.length}  → ${JSON.stringify(by)}`);
  console.log(`Ya eran nombre: ${yaNombre.length}`);
  console.log(`Sin resolver (email fuera de CRM y USUARIOS_ROLES): ${sinResolver.length}`);

  fs.writeFileSync('docs/asesor-asignado-ya-nombre.csv', '﻿' + [
    csv(['contrato', 'titular', 'asesor (ya nombre)']),
    ...yaNombre.map(t => csv([t.contrato, nombreCompleto(t), t.asesor])),
  ].join('\r\n'), 'utf8');
  console.log(`\nCSV ya-nombre:    docs/asesor-asignado-ya-nombre.csv (${yaNombre.length})`);

  if (sinResolver.length) {
    fs.writeFileSync('docs/asesor-asignado-sin-resolver.csv', '﻿' + [
      csv(['contrato', 'titular', 'asesor (email)']),
      ...sinResolver.map(t => csv([t.contrato, nombreCompleto(t), t.asesor])),
    ].join('\r\n'), 'utf8');
    console.log(`CSV sin-resolver: docs/asesor-asignado-sin-resolver.csv (${sinResolver.length})`);
  }

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para escribir (SOBRESCRIBE).`); await crm.end(); await lgs.end(); return; }

  await lgs.query('BEGIN');
  let ok = 0;
  try {
    for (const u of updates) {
      await lgs.query(`UPDATE "PEOPLE" SET "asesorAsignado"=$2,"_updatedDate"=NOW() WHERE "_id"=$1`, [u._id, u.nombre]);
      ok++;
    }
    await lgs.query('COMMIT');
  } catch (e) { await lgs.query('ROLLBACK').catch(() => {}); throw e; }
  console.log(`\n🟢 APPLY: ${ok} titulares con asesorAsignado poblado (sobrescrito).`);
  await crm.end(); await lgs.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
