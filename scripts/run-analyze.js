#!/usr/bin/env node
/**
 * run-analyze.js — Ejecuta ANALYZE (refresca estadisticas del planner) sobre
 * toda la BD. Read-only respecto a los datos (solo actualiza pg_statistic).
 *
 * Imprime reltuples (estimacion del planner) ANTES y DESPUES para las tablas
 * calientes, como prueba de que el ANALYZE corrio y corrigio las stats.
 *
 * Lo invoca scripts/scheduled-analyze.ps1 (que maneja el firewall). Tambien
 * se puede correr a mano desde una IP whitelisted: node scripts/run-analyze.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
const c = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  statement_timeout: 300000, // 5 min tope por si la instancia esta cargada
});
const HOT = ['ACADEMICA_BOOKINGS', 'CALENDARIO', 'PEOPLE', 'ACADEMICA', 'USUARIOS_ROLES'];
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

async function reltuples() {
  const out = {};
  for (const t of HOT) {
    const r = await c.query(`SELECT reltuples::bigint AS n FROM pg_class WHERE relname = $1`, [t]);
    out[t] = r.rows[0] ? Number(r.rows[0].n) : null;
  }
  return out;
}

(async () => {
  await c.connect();
  log('conectado — reltuples (estimacion del planner) ANTES:');
  log('  ' + JSON.stringify(await reltuples()));

  const t0 = Date.now();
  await c.query('ANALYZE');
  log(`ANALYZE (toda la BD) completado en ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  log('reltuples DESPUES:');
  log('  ' + JSON.stringify(await reltuples()));

  await c.end();
  log('OK');
})().catch((e) => { log('FATAL ' + e.message); process.exit(1); });
