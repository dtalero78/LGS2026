#!/usr/bin/env node
/**
 * add-valor-aplicado-column.js — Agrega la columna `valorAplicado` a
 * PAGOS_TITULARES (idempotente) y rellena las filas existentes.
 *
 * valorAplicado = max(0, valorPagado - descuento) — "Valor a Aplicar" del wizard
 * (lo que efectivamente reduce el saldo). Hasta ahora se calculaba pero no se
 * guardaba; esta columna lo persiste.
 *
 * USO:
 *   node scripts/add-valor-aplicado-column.js            # dry-run (no escribe)
 *   node scripts/add-valor-aplicado-column.js --apply    # aplica
 * REQUISITO: IP en Trusted Sources de la BD + .env.local con DATABASE_URL.
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();

  // ¿Existe ya la columna?
  const col = await c.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='PAGOS_TITULARES' AND column_name='valorAplicado'`
  );
  const existe = col.rowCount > 0;
  console.log(`Columna valorAplicado: ${existe ? 'YA EXISTE' : 'no existe'}`);

  // Filas que quedarían backfilleadas (valorAplicado NULL)
  let pendientes = 0;
  if (existe) {
    const r = await c.query(`SELECT COUNT(*)::int n FROM "PAGOS_TITULARES" WHERE "valorAplicado" IS NULL`);
    pendientes = r.rows[0].n;
  } else {
    const r = await c.query(`SELECT COUNT(*)::int n FROM "PAGOS_TITULARES"`);
    pendientes = r.rows[0].n;
  }
  console.log(`Filas a backfillear (valorAplicado): ${pendientes}`);

  if (!APPLY) {
    console.log('\n🟡 DRY-RUN. Para aplicar: node scripts/add-valor-aplicado-column.js --apply');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    await c.query(`ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "valorAplicado" NUMERIC(12,2)`);
    const upd = await c.query(
      `UPDATE "PAGOS_TITULARES"
       SET "valorAplicado" = GREATEST(0, COALESCE("valorPagado",0) - COALESCE("descuento",0))
       WHERE "valorAplicado" IS NULL`
    );
    await c.query('COMMIT');
    console.log(`\n🟢 APPLY: columna lista. Filas backfilleadas: ${upd.rowCount}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  }
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
