#!/usr/bin/env node
/**
 * run-analyze.js — Ejecuta ANALYZE (refresca estadisticas del planner) sobre
 * toda la BD y luego pg_stat_statements_reset() (linea base limpia para medir
 * el efecto de los fixes). Read-only respecto a los datos del negocio: solo
 * actualiza pg_statistic y resetea contadores de monitoreo.
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

  // Reset de pg_stat_statements: linea base limpia post-ANALYZE para poder medir
  // en 24-48h el efecto real de los fixes (N+1, indices, ANALYZE) sin el acumulado
  // viejo contaminando el promedio. No toca datos; solo metadata de monitoreo.
  try {
    await c.query('SELECT pg_stat_statements_reset()');
    log('pg_stat_statements RESETEADO — medicion limpia desde ahora. Re-medir con db-metrics.js en 24-48h y comparar contra §6 de docs/TABLAS-Y-PROCESOS.md.');
  } catch (e) {
    log('AVISO: no se pudo resetear pg_stat_statements (continua igual): ' + e.message);
  }

  await c.end();
  log('OK');
})().catch((e) => { log('FATAL ' + e.message); process.exit(1); });
