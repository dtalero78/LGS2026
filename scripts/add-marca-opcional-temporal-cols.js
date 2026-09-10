#!/usr/bin/env node
/**
 * add-marca-opcional-temporal-cols.js — la marca "Opcional" puede ser TEMPORAL.
 *
 * Hasta ahora `PEOPLE.marcaOpcional` era un toggle simple ('OPC' | NULL). Se
 * agrega la posibilidad de marcarla **hasta una fecha**, tras la cual vuelve
 * sola al estado anterior:
 *
 *   marcaOpcionalHasta    DATE         NULL = definitiva. Con fecha = vence ese día.
 *   marcaOpcionalAnterior VARCHAR(20)  valor al que revertir cuando vence.
 *
 * `DATE` puro (sin hora ni TZ), como el resto de fechas de contrato del sistema.
 *
 * La reversión ocurre por dos vías (mismo patrón que OnHold):
 *   1. cron diario  → limpia las vencidas en BD
 *   2. al consultar → la vista de asignación ya las trata como vencidas, así
 *      que la pantalla es exacta aunque el cron todavía no haya corrido.
 *
 * Idempotente: ADD COLUMN IF NOT EXISTS. Dry-run por defecto; --apply escribe.
 * USO: node scripts/add-marca-opcional-temporal-cols.js [--apply]
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
  console.log(`\n===== PEOPLE.marcaOpcional temporal (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const cols = (await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'PEOPLE'
        AND column_name IN ('marcaOpcional','marcaOpcionalHasta','marcaOpcionalAnterior')`,
  )).rows;
  const tiene = (n) => cols.find((r) => r.column_name === n);

  console.log('\nColumnas:');
  for (const n of ['marcaOpcional', 'marcaOpcionalHasta', 'marcaOpcionalAnterior']) {
    const r = tiene(n);
    console.log(`  ${n.padEnd(24)} ${r ? 'existe (' + r.data_type + ')' : 'no existe (se creará)'}`);
  }

  const marcados = (await c.query(
    `SELECT COUNT(*)::int AS n FROM "PEOPLE" WHERE "marcaOpcional" = 'OPC'`,
  )).rows[0].n;
  console.log(`\nTitulares marcados OPC hoy: ${marcados} (todos quedan como DEFINITIVOS — sin fecha de vencimiento)`);

  if (!APPLY) { console.log('\n[dry-run] usa --apply para escribir\n'); await c.end(); return; }

  await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "marcaOpcionalHasta" DATE`);
  await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "marcaOpcionalAnterior" VARCHAR(20)`);

  // Índice parcial: el cron solo busca las marcas CON fecha, que son pocas.
  await c.query(
    `CREATE INDEX IF NOT EXISTS "idx_people_marca_opcional_hasta"
       ON "PEOPLE" ("marcaOpcionalHasta")
     WHERE "marcaOpcionalHasta" IS NOT NULL`,
  );

  const check = (await c.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'PEOPLE'
        AND column_name IN ('marcaOpcionalHasta','marcaOpcionalAnterior')
      ORDER BY column_name`,
  )).rows;
  console.log('\n✔ Listo:');
  for (const r of check) console.log(`  ${r.column_name} ${r.data_type} (nullable: ${r.is_nullable})`);
  console.log('  idx_people_marca_opcional_hasta (parcial)\n');

  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
