#!/usr/bin/env node
/**
 * add-academica-foto-spaces-index.js
 *
 * Índice PARCIAL para acelerar el tab "Usuarios" de Lgs-Buckets.
 * Sólo indexa las filas de ACADEMICA cuya foto vive en Spaces (~467 de ~6k),
 * ordenadas por (primerApellido, primerNombre) para servir el ORDER BY del
 * listado sin scan secuencial. Idempotente (IF NOT EXISTS) y CONCURRENTLY
 * (no bloquea escrituras). Como es parcial, el costo de escritura es mínimo:
 * sólo afecta INSERT/UPDATE que dejan una foto de Spaces.
 *
 * USO:  node scripts/add-academica-foto-spaces-index.js [--apply]
 *       (sin --apply sólo muestra el plan actual; con --apply crea el índice)
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });

const PRED = `"foto" IS NOT NULL AND ("foto" LIKE '%digitaloceanspaces.com%' OR "foto" LIKE 'fotos/%')`;
const W = `WHERE "foto" IS NOT NULL AND TRIM("foto")<>'' AND ("foto" LIKE '%digitaloceanspaces.com%' OR "foto" LIKE 'fotos/%')`;

async function explain(label, sql) {
  const r = await client.query(`EXPLAIN (ANALYZE, TIMING) ${sql}`);
  const plan = r.rows.map(x => x['QUERY PLAN']);
  const scan = plan.find(l => /Seq Scan|Index Scan|Index Only Scan|Bitmap/.test(l));
  const exec = plan.find(l => l.startsWith('Execution Time'));
  console.log(`  ${label}:`);
  console.log(`    ${scan ? scan.trim() : '(scan?)'}`);
  console.log(`    ${exec ? exec.trim() : '(exec?)'}`);
}

(async () => {
  await client.connect();
  const countSql = `SELECT COUNT(*) FROM "ACADEMICA" ${W}`;
  const pageSql = `SELECT "_id","primerNombre","primerApellido" FROM "ACADEMICA" ${W} ORDER BY "primerApellido" NULLS LAST, "primerNombre" NULLS LAST LIMIT 24 OFFSET 0`;

  console.log(`\nModo: ${APPLY ? '🔴 APPLY' : '🟡 DRY-RUN'}`);
  console.log('\n== ANTES ==');
  await explain('COUNT', countSql);
  await explain('PAGE', pageSql);

  if (APPLY) {
    console.log('\nCreando índice parcial (CONCURRENTLY)…');
    await client.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_academica_foto_spaces"
       ON "ACADEMICA" ("primerApellido", "primerNombre")
       WHERE ${PRED}`
    );
    console.log('✅ Índice creado (o ya existía).');
    console.log('\n== DESPUÉS ==');
    await explain('COUNT', countSql);
    await explain('PAGE', pageSql);
  }
  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
