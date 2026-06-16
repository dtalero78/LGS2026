#!/usr/bin/env node
/**
 * grant-recaudo-asist-pagos-perms.js
 *
 * Agrega a RECAUDO_ASIST (en ROL_PERMISOS.permisos) los permisos de pagos que
 * le falten para poder VER pagos, REGISTRAR/adjuntar documentos e IMPRIMIR
 * recibos. Idempotente: solo agrega lo que falta. Dry-run por defecto.
 *
 * USO:  node scripts/grant-recaudo-asist-pagos-perms.js [--apply] [--rol=RECAUDO_ASIST]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const rolArg = process.argv.find(a => a.startsWith('--rol='));
const ROL = rolArg ? rolArg.split('=')[1] : 'RECAUDO_ASIST';
const TARGET = [
  'PERSON.FINANCIERA.PAGOS_VER',
  'PERSON.FINANCIERA.PAGOS_REGISTRAR',
  'PERSON.FINANCIERA.PAGOS_RECIBO',
];

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });

(async () => {
  await client.connect();
  const { rows } = await client.query(`SELECT "permisos" FROM "ROL_PERMISOS" WHERE "rol" = $1`, [ROL]);
  if (!rows.length) { console.error(`❌ Rol ${ROL} no existe en ROL_PERMISOS`); process.exit(1); }
  let current = rows[0].permisos;
  if (typeof current === 'string') current = JSON.parse(current);
  if (!Array.isArray(current)) current = [];

  const missing = TARGET.filter(p => !current.includes(p));
  console.log(`\nRol: ${ROL}   (modo: ${APPLY ? '🔴 APPLY' : '🟡 DRY-RUN'})`);
  console.log(`Total permisos actuales: ${current.length}`);
  console.log('\nPermisos de pagos:');
  for (const p of TARGET) console.log(`  ${current.includes(p) ? '✅ tiene' : '➕ FALTA'}  ${p}`);

  if (!missing.length) { console.log('\nNada que agregar — ya tiene los 3.\n'); await client.end(); return; }

  if (!APPLY) { console.log(`\n🟡 DRY-RUN: agregaría ${missing.length} -> ${missing.join(', ')}\n`); await client.end(); return; }

  const next = Array.from(new Set([...current, ...missing]));
  await client.query(
    `UPDATE "ROL_PERMISOS" SET "permisos" = $1, "_updatedDate" = NOW(), "fechaActualizacion" = NOW() WHERE "rol" = $2`,
    [JSON.stringify(next), ROL]
  );
  console.log(`\n✅ Agregados: ${missing.join(', ')}`);
  console.log(`Total permisos ahora: ${next.length}\n`);
  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
