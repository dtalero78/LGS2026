/**
 * update-niveles-contenido.js
 *
 * Agrega la columna "contenido" a la tabla NIVELES (si no existe) y
 * la llena con los datos del endpoint Wix /exportarNiveles.
 *
 * Uso:
 *   node migration/update-niveles-contenido.js
 *   node migration/update-niveles-contenido.js --dry-run   # Solo muestra qué haría, sin escribir
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { Pool } = require('pg');
const config = require('./config');

const WIX_ENDPOINT = `${config.wix.baseUrl}${config.wixEndpoints.NIVELES}`;
const BATCH_SIZE = config.batching.NIVELES;
const DRY_RUN = process.argv.includes('--dry-run');

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convierte el valor de "contenido" a un string apto para almacenar en TEXT.
 * Si es un objeto/array lo serializa a JSON; si es string lo devuelve tal cual.
 */
function normalizeContenido(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ── Fetch paginado desde Wix ───────────────────────────────────────────────

async function fetchAllFromWix() {
  let skip = 0;
  const all = [];

  while (true) {
    const url = `${WIX_ENDPOINT}?skip=${skip}&limit=${BATCH_SIZE}`;
    console.log(`📡 Fetching NIVELES from Wix: skip=${skip}, limit=${BATCH_SIZE}`);

    let batch;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeout: config.wix.timeout,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Wix returned success: false');

        batch = data.data || data.items || [];
        break; // éxito
      } catch (err) {
        console.warn(`  ⚠️  Intento ${attempt}/3 falló: ${err.message}`);
        if (attempt === 3) throw err;
        await sleep(2000 * attempt);
      }
    }

    console.log(`  ✅ ${batch.length} registros obtenidos`);
    all.push(...batch);

    if (batch.length < BATCH_SIZE) break; // última página
    skip += batch.length;
    await sleep(config.rateLimit.NIVELES);
  }

  return all;
}

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 update-niveles-contenido');
  console.log(`   Dry run: ${DRY_RUN ? 'SÍ' : 'NO'}`);
  console.log('='.repeat(60) + '\n');

  const pool = new Pool(config.postgres);

  try {
    // 1. Verificar conexión
    console.log('🔌 Conectando a PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa\n');

    // 2. Agregar columna si no existe
    const addColSQL = `ALTER TABLE "NIVELES" ADD COLUMN IF NOT EXISTS "contenido" TEXT`;

    if (DRY_RUN) {
      console.log('🔍 [DRY-RUN] Se ejecutaría:', addColSQL);
    } else {
      await pool.query(addColSQL);
      console.log('✅ Columna "contenido" agregada (o ya existía)\n');
    }

    // 3. Obtener todos los registros de Wix
    console.log('📥 Obteniendo NIVELES desde Wix...');
    const records = await fetchAllFromWix();
    console.log(`\n📊 Total obtenido de Wix: ${records.length} registros\n`);

    if (records.length === 0) {
      console.log('⚠️  No se encontraron registros. Saliendo.');
      return;
    }

    // 4. Actualizar contenido en PG
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const rec of records) {
      const { _id, contenido } = rec;

      if (!_id) {
        console.warn('  ⚠️  Registro sin _id, se omite');
        skipped++;
        continue;
      }

      const value = normalizeContenido(contenido);

      if (DRY_RUN) {
        const preview = value ? value.slice(0, 60) + (value.length > 60 ? '...' : '') : 'null';
        console.log(`  🔍 [DRY-RUN] UPDATE "_id"=${_id}  contenido="${preview}"`);
        updated++;
        continue;
      }

      try {
        const result = await pool.query(
          `UPDATE "NIVELES" SET "contenido" = $1 WHERE "_id" = $2`,
          [value, _id]
        );

        if (result.rowCount === 0) {
          console.warn(`  ⚠️  No se encontró registro con _id=${_id} en PG`);
          skipped++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`  ❌ Error actualizando _id=${_id}: ${err.message}`);
        failed++;
      }
    }

    // 5. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('✅ Completado');
    console.log(`   Actualizados : ${updated}`);
    console.log(`   Omitidos     : ${skipped}`);
    console.log(`   Fallidos     : ${failed}`);
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
