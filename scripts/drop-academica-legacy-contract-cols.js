#!/usr/bin/env node
/**
 * drop-academica-legacy-contract-cols.js — elimina de ACADEMICA las columnas
 * legacy de contrato/extensión/OnHold que en realidad VIVEN EN PEOPLE.
 *
 * Columnas a dropear (todas residuos de la migración Wix, sin datos reales:
 * extensionCount todo 0, extensionHistory todo '[]', onHoldCount todo 0,
 * vigencia/finalContrato/fechaContrato poblados en ~1 fila):
 *   - vigencia
 *   - finalContrato
 *   - fechaContrato
 *   - extensionCount
 *   - extensionHistory
 *   - onHoldCount
 *
 * `estadoInactivo` NO se toca (vive en ACADEMICA, se sincroniza en las
 * inactivaciones/reactivaciones).
 *
 * ⚠️ ORDEN: correr SOLO DESPUÉS de que el deploy que quita las referencias en
 * academica.repository.ts (findByAnyId SELECT + COALESCE de vigencia) esté LIVE
 * en producción. Si se corre antes, el código viejo (que nombra esas columnas)
 * rompería.
 *
 * Idempotente (DROP COLUMN IF EXISTS). Dry-run por defecto; --apply para escribir.
 * USO: node scripts/drop-academica-legacy-contract-cols.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

const COLS = ['vigencia', 'finalContrato', 'fechaContrato', 'extensionCount', 'extensionHistory', 'onHoldCount'];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== DROP columnas legacy de ACADEMICA (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const existentes = (await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='ACADEMICA' AND column_name = ANY($1)`, [COLS])).rows.map(r => r.column_name);
  console.log('\nColumnas presentes a dropear:', existentes.length ? existentes : '(ninguna — ya dropeadas)');

  if (!APPLY) { console.log('\n[dry-run] usa --apply para escribir'); await c.end(); return; }

  for (const col of COLS) {
    await c.query(`ALTER TABLE "ACADEMICA" DROP COLUMN IF EXISTS "${col}"`);
  }

  const restantes = (await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='ACADEMICA' AND column_name = ANY($1)`, [COLS])).rows.map(r => r.column_name);
  console.log(`\n✔ DROP aplicado. Columnas restantes de la lista: ${restantes.length ? restantes.join(', ') : '0 (todas eliminadas)'}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
