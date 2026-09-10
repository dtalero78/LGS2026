#!/usr/bin/env node
/**
 * add-nota-column.js — agrega PAGOS_TITULARES.nota (TEXT).
 *
 * Nota del pago. Es OBLIGATORIA cuando el pago se marca como
 * "Penalidad o Recuperación" o como "Cambio Contado": son los dos casos donde
 * el valor del pago no corresponde a una cuota normal y hay que dejar por
 * escrito el motivo. En el resto de los pagos queda NULL.
 *
 * Idempotente: ADD COLUMN IF NOT EXISTS. Dry-run por defecto; --apply escribe.
 * USO: node scripts/add-nota-column.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();
  console.log(`\n===== PAGOS_TITULARES.nota (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const existe = (await c.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_name = 'PAGOS_TITULARES' AND column_name = 'nota'`
  )).rows[0];
  console.log(`\nColumna nota: ${existe ? 'ya existe (' + existe.data_type + ')' : 'no existe (se creará)'}`);

  const total = (await c.query(`SELECT COUNT(*)::int AS n FROM "PAGOS_TITULARES"`)).rows[0].n;
  const marcados = (await c.query(
    `SELECT COUNT(*) FILTER (WHERE "penalidad" IS TRUE)::int AS penalidad,
            COUNT(*) FILTER (WHERE "cambioContado" IS TRUE)::int AS contado
       FROM "PAGOS_TITULARES"`
  )).rows[0];
  console.log(`Filas en PAGOS_TITULARES: ${total} (penalidad: ${marcados.penalidad} · cambioContado: ${marcados.contado})`);
  console.log('Los pagos ya registrados quedan con nota NULL — la obligatoriedad aplica solo a los nuevos.');

  if (!APPLY) { console.log('\n[dry-run] usa --apply para escribir\n'); await c.end(); return; }

  await c.query(`ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "nota" TEXT`);

  const check = (await c.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'PAGOS_TITULARES' AND column_name = 'nota'`
  )).rows[0];
  console.log(`\n✔ Columna lista: ${check.column_name} ${check.data_type} (nullable: ${check.is_nullable})\n`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
