#!/usr/bin/env node
/**
 * fix-evento-step17-to-18.js — corrige el step de un evento CLUB mal etiquetado.
 *
 * Evento evt_1783225097437_53rnkq5zl (P1 · TRAINING · lunes 6-jul-2026 19:00,
 * advisor Laura Torres Gonzalez): estaba como "TRAINING - Step 17" y debe ser
 * "TRAINING - Step 18". El nivel P1 se mantiene (Step 18 sigue siendo P1).
 *
 * Cambia SOLO el label del step en 3 campos, en 2 tablas:
 *   - CALENDARIO         (1 fila):  step, nombreEvento, tituloONivel
 *   - ACADEMICA_BOOKINGS (10 filas, por eventoId OR idEvento): idem
 * (nivel/titulo/club/tipo NO se tocan)
 *
 * Idempotente: solo actualiza filas que aún tienen "TRAINING - Step 17", así que
 * re-correrlo no hace nada. Dry-run por defecto; escribe con --apply (transacción).
 * USO: node scripts/fix-evento-step17-to-18.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');
const EVENT_ID = 'evt_1783225097437_53rnkq5zl';

const OLD_STEP = 'TRAINING - Step 17';
const NEW_STEP = 'TRAINING - Step 18';
const OLD_TON  = 'P1 - TRAINING - Step 17';
const NEW_TON  = 'P1 - TRAINING - Step 18';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== FIX ${EVENT_ID}: "${OLD_STEP}" → "${NEW_STEP}" (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const calBefore = (await c.query(`SELECT "step","nombreEvento","tituloONivel","nivel" FROM "CALENDARIO" WHERE "_id"=$1`, [EVENT_ID])).rows[0];
  console.log('\nCALENDARIO antes:', calBefore);
  const bkBefore = (await c.query(`SELECT COUNT(*)::int AS total, array_agg(DISTINCT "step") AS steps FROM "ACADEMICA_BOOKINGS" WHERE "eventoId"=$1 OR "idEvento"=$1`, [EVENT_ID])).rows[0];
  console.log('ACADEMICA_BOOKINGS antes:', bkBefore);

  if (!APPLY) { console.log('\n[dry-run] usa --apply para escribir'); await c.end(); return; }

  await c.query('BEGIN');
  try {
    const r1 = await c.query(
      `UPDATE "CALENDARIO"
          SET "step"=$2::text, "nombreEvento"=$2::text, "tituloONivel"=$4::text, "_updatedDate"=NOW()
        WHERE "_id"=$1 AND "step"=$3::text`,
      [EVENT_ID, NEW_STEP, OLD_STEP, NEW_TON]);
    const r2 = await c.query(
      `UPDATE "ACADEMICA_BOOKINGS"
          SET "step"=$2::text, "nombreEvento"=$2::text, "tituloONivel"=$4::text, "_updatedDate"=NOW()
        WHERE ("eventoId"=$1 OR "idEvento"=$1) AND "step"=$3::text`,
      [EVENT_ID, NEW_STEP, OLD_STEP, NEW_TON]);
    await c.query('COMMIT');
    console.log(`\n✔ CALENDARIO: ${r1.rowCount} fila(s) · ACADEMICA_BOOKINGS: ${r2.rowCount} fila(s)`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  const calAfter = (await c.query(`SELECT "step","nombreEvento","tituloONivel","nivel" FROM "CALENDARIO" WHERE "_id"=$1`, [EVENT_ID])).rows[0];
  console.log('\nCALENDARIO después:', calAfter);
  const bkAfter = (await c.query(`SELECT COUNT(*)::int AS total, array_agg(DISTINCT "step") AS steps FROM "ACADEMICA_BOOKINGS" WHERE "eventoId"=$1 OR "idEvento"=$1`, [EVENT_ID])).rows[0];
  console.log('ACADEMICA_BOOKINGS después:', bkAfter);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
