#!/usr/bin/env node
/**
 * backfill-plan-desde-cuotas.js — rellena PEOPLE.plan vacío infiriéndolo de
 * FINANCIEROS.numeroCuotas del contrato.
 *
 * REGLA (la misma del backfill histórico backfill-plan-credito-by-cuotas.js):
 *   numeroCuotas  >  1   → 'Credito'   (pago en cuotas)
 *   numeroCuotas  =  1   → 'Contado'   (pago único)
 *   numeroCuotas  =  0   → NO se toca  (0 no distingue contado de dato vacío)
 *   numeroCuotas  > 60   → NO se toca  (dato sucio: hay filas con 110000, que
 *                                       parece un MONTO metido en el campo)
 *   sin FINANCIEROS      → NO se toca  (no hay de dónde inferir)
 *
 * `plan` es del CONTRATO, así que se aplica al titular Y a sus beneficiarios,
 * pero SOLO donde está vacío — nunca pisa un plan ya registrado.
 *
 * Idempotente (re-correrlo no cambia nada) y transaccional.
 * Dry-run por defecto; --apply escribe.
 *
 * USO: node scripts/backfill-plan-desde-cuotas.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

// Contratos con un numeroCuotas del que SÍ se puede inferir el plan.
const CTE_INFERIBLE = `
  WITH fin AS (
    SELECT DISTINCT ON (f."contrato")
           f."contrato",
           f."numeroCuotas"::numeric AS cuotas
      FROM "FINANCIEROS" f
     WHERE COALESCE(f."contrato", '') <> ''
       AND f."numeroCuotas" IS NOT NULL
       AND f."numeroCuotas"::text ~ '^[0-9]+$'
     ORDER BY f."contrato", f."_createdDate" DESC NULLS LAST
  ),
  inferible AS (
    SELECT "contrato",
           CASE WHEN cuotas > 1 THEN 'Credito' ELSE 'Contado' END AS plan_inferido,
           cuotas
      FROM fin
     WHERE cuotas >= 1 AND cuotas <= 60      -- descarta 0 y los valores absurdos
  )
`;

// Personas objetivo: plan vacío + contrato con cuotas inferibles. Nunca PRB-.
const WHERE_OBJETIVO = `
    p."contrato" = i."contrato"
    AND COALESCE(TRIM(p."plan"), '') = ''
    AND COALESCE(p."contrato", '') NOT LIKE 'PRB-%'
`;

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();
  console.log(`\n===== Backfill PEOPLE.plan desde FINANCIEROS.numeroCuotas (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  // ── Qué se va a tocar ──
  const preview = (await c.query(`
    ${CTE_INFERIBLE}
    SELECT i.plan_inferido,
           COUNT(*)::int                                   AS personas,
           COUNT(DISTINCT p."contrato")::int               AS contratos,
           COUNT(*) FILTER (WHERE p."tipoUsuario" = 'TITULAR')::int AS titulares
      FROM "PEOPLE" p
      JOIN inferible i ON ${WHERE_OBJETIVO}
     GROUP BY i.plan_inferido
     ORDER BY personas DESC
  `)).rows;

  console.log('\nSE VAN A ACTUALIZAR:');
  let total = 0;
  for (const r of preview) {
    console.log(`  ${r.plan_inferido.padEnd(10)} ${String(r.personas).padStart(5)} personas  (${r.contratos} contratos, ${r.titulares} titulares)`);
    total += r.personas;
  }
  console.log(`  ${''.padEnd(10)} ${String(total).padStart(5)} TOTAL`);

  // ── Qué NO se toca y por qué ──
  const excluidos = (await c.query(`
    WITH fin AS (
      SELECT DISTINCT ON (f."contrato") f."contrato", f."numeroCuotas"::text AS cuotas
        FROM "FINANCIEROS" f
       WHERE COALESCE(f."contrato", '') <> ''
       ORDER BY f."contrato", f."_createdDate" DESC NULLS LAST
    )
    SELECT CASE
             WHEN fin."contrato" IS NULL              THEN 'sin registro en FINANCIEROS'
             WHEN fin.cuotas !~ '^[0-9]+$'            THEN 'numeroCuotas no numerico'
             WHEN fin.cuotas::numeric = 0             THEN 'numeroCuotas = 0 (indeterminado)'
             WHEN fin.cuotas::numeric > 60            THEN 'numeroCuotas absurdo (dato sucio)'
             ELSE 'otro'
           END AS motivo,
           COUNT(*)::int AS personas
      FROM "PEOPLE" p
      LEFT JOIN fin ON fin."contrato" = p."contrato"
     WHERE COALESCE(TRIM(p."plan"), '') = ''
       AND COALESCE(p."contrato", '') NOT LIKE 'PRB-%'
       AND (fin."contrato" IS NULL
            OR fin.cuotas !~ '^[0-9]+$'
            OR fin.cuotas::numeric = 0
            OR fin.cuotas::numeric > 60)
     GROUP BY 1 ORDER BY personas DESC
  `)).rows;

  console.log('\nNO SE TOCAN (quedan sin plan, requieren revisión manual):');
  let sinTocar = 0;
  for (const r of excluidos) {
    console.log(`  ${String(r.personas).padStart(5)}  ${r.motivo}`);
    sinTocar += r.personas;
  }
  console.log(`  ${String(sinTocar).padStart(5)}  TOTAL sin resolver`);

  if (!APPLY) {
    console.log('\n[dry-run] usa --apply para escribir\n');
    await c.end();
    return;
  }

  // ── Aplicar (transaccional) ──
  await c.query('BEGIN');
  try {
    const upd = await c.query(`
      ${CTE_INFERIBLE}
      UPDATE "PEOPLE" p
         SET "plan" = i.plan_inferido,
             "_updatedDate" = NOW()
        FROM inferible i
       WHERE ${WHERE_OBJETIVO}
    `);
    await c.query('COMMIT');
    console.log(`\n✔ ${upd.rowCount} filas actualizadas en PEOPLE.`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  // ── Verificación posterior ──
  const despues = (await c.query(`
    SELECT COALESCE(NULLIF(TRIM("plan"), ''), '(sin plan)') AS plan, COUNT(*)::int AS n
      FROM "PEOPLE"
     WHERE COALESCE("contrato", '') NOT LIKE 'PRB-%'
     GROUP BY 1 ORDER BY n DESC
  `)).rows;
  console.log('\nPEOPLE.plan tras el backfill:');
  for (const r of despues) console.log(`  ${r.plan.padEnd(12)} ${r.n}`);
  console.log('');

  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
