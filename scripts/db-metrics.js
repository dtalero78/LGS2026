#!/usr/bin/env node
/**
 * db-metrics.js — Recolecta métricas reales de la BD para el análisis de
 * docs/TABLAS-Y-PROCESOS.md (tamaño por tabla, índices, scans, pg_stat_statements).
 *
 * Read-only. Una sola conexión, queries secuenciales (la BD basic se satura).
 *
 * USO:
 *   node scripts/db-metrics.js              # imprime resumen + escribe scripts/_db-metrics-out.json
 *
 * REQUISITO: la IP desde la que corres debe estar en "Trusted Sources" de la
 * BD managed en el panel de DigitalOcean (Databases → lgs-db → Settings).
 * Si no, la conexión al puerto 25060 da timeout.
 */
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

async function q(label, sql) {
  try { return { label, ok: true, rows: (await client.query(sql)).rows }; }
  catch (e) { return { label, ok: false, error: e.message }; }
}

(async () => {
  const out = {};
  await client.connect();

  out.dbInfo = await q('dbInfo', `
    SELECT current_database() AS db,
           pg_size_pretty(pg_database_size(current_database())) AS db_size,
           (SELECT setting FROM pg_settings WHERE name='max_connections') AS max_connections,
           (SELECT count(*) FROM pg_stat_activity) AS active_connections,
           version() AS version`);

  out.tables = await q('tables', `
    SELECT c.relname AS tabla, s.n_live_tup AS filas_vivas, s.n_dead_tup AS filas_muertas,
           s.seq_scan, s.idx_scan, s.n_tup_ins AS inserts, s.n_tup_upd AS updates, s.n_tup_del AS deletes,
           pg_total_relation_size(c.oid) AS total_bytes,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
           pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
           pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_size
    FROM pg_stat_user_tables s JOIN pg_class c ON c.oid = s.relid
    ORDER BY pg_total_relation_size(c.oid) DESC`);

  out.indexes = await q('indexes', `
    SELECT relname AS tabla, indexrelname AS indice, idx_scan AS scans,
           pg_size_pretty(pg_relation_size(indexrelid)) AS size, pg_relation_size(indexrelid) AS bytes
    FROM pg_stat_user_indexes ORDER BY pg_relation_size(indexrelid) DESC`);

  out.unusedIndexes = await q('unusedIndexes', `
    SELECT relname AS tabla, indexrelname AS indice, idx_scan AS scans,
           pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes WHERE idx_scan = 0
    ORDER BY pg_relation_size(indexrelid) DESC`);

  out.pgStatStatements = await q('pgStatStatements', `
    SELECT calls, round(total_exec_time::numeric,1) AS total_ms, round(mean_exec_time::numeric,2) AS mean_ms,
           rows, left(regexp_replace(query, '\\s+', ' ', 'g'), 160) AS query
    FROM pg_stat_statements
    WHERE query NOT ILIKE '%pg_stat%' AND query NOT ILIKE '%information_schema%'
    ORDER BY total_exec_time DESC LIMIT 25`);

  await client.end();
  fs.writeFileSync('scripts/_db-metrics-out.json', JSON.stringify(out, null, 2));

  // Resumen legible
  if (out.dbInfo.ok) { const i = out.dbInfo.rows[0];
    console.log(`\nBD: ${i.db} | tamaño ${i.db_size} | conexiones ${i.active_connections}/${i.max_connections}`); }
  if (out.tables.ok) {
    console.log('\nTABLA                            FILAS   TOTAL    SEQ_SCAN  IDX_SCAN');
    for (const r of out.tables.rows)
      console.log(`${(r.tabla||'').padEnd(32)} ${String(r.filas_vivas).padStart(7)} ${(r.total_size||'').padStart(8)} ${String(r.seq_scan).padStart(9)} ${String(r.idx_scan).padStart(9)}`);
  }
  console.log('\nJSON completo: scripts/_db-metrics-out.json');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
