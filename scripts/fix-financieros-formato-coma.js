#!/usr/bin/env node
/**
 * fix-financieros-formato-coma.js — Normaliza los FINANCIEROS cuyos montos están
 * en formato "europeo/Perú" con coma decimal (ej. "3.780,00") a formato canónico
 * entero ("3780"), y recalcula el saldo. Sin esto, el cálculo del saldo en
 * backend leía "3.780,00" como 3.78 → "Saldo a la Fecha" salía en $0.
 *
 * Por cada FINANCIEROS con coma en totalPlan/valorCuota/pagoInscripcion:
 *   - normaliza esos 3 campos a entero (punto=miles, coma=decimal → entero)
 *   - FINANCIEROS.saldo = max(0, totalPlan − Σ pagos validados); cuotasPagadas
 *   - cuota #0 (PAGOS_TITULARES): saldo = max(0, totalPlan − inscripción) y
 *     rellena vlrTotalProg/valorCuota/inscripcion si están null
 *
 * Idempotente (dry-run + --apply, transacción por contrato).
 * USO: node scripts/fix-financieros-formato-coma.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

// Mismo parser que toNum() del backend: coma=decimal, punto=miles.
function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
const toInt = v => String(Math.round(toNum(v)));

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== FIX FINANCIEROS FORMATO COMA (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const { rows } = await c.query(
    `SELECT "contrato","totalPlan","valorCuota","pagoInscripcion","saldo"
     FROM "FINANCIEROS"
     WHERE "totalPlan" LIKE '%,%' OR "valorCuota" LIKE '%,%' OR "pagoInscripcion" LIKE '%,%'
     ORDER BY "contrato"`);
  console.log(`FINANCIEROS con formato coma: ${rows.length}`);
  if (rows.length) {
    console.log('\nEjemplos (antes → después):');
    rows.slice(0, 8).forEach(r => console.log(`  ${r.contrato}: totalPlan "${r.totalPlan}"→${toInt(r.totalPlan)}  saldoActual "${r.saldo}"`));
  }

  if (!APPLY) { console.log(`\n[dry-run] usa --apply`); await c.end(); return; }

  let ok = 0, fail = 0, cuota0Fix = 0;
  for (const r of rows) {
    const K = r.contrato;
    try {
      await c.query('BEGIN');
      const totalPlan = Math.round(toNum(r.totalPlan));
      const inscripcion = Math.round(toNum(r.pagoInscripcion));
      const valorCuota = Math.round(toNum(r.valorCuota));

      // Σ validados + cuotas pagadas (idPeople del titular del contrato)
      const s = (await c.query(
        `SELECT COALESCE(SUM(COALESCE("valorPagado",0)+COALESCE("descuento",0)),0)::text total,
                COALESCE(SUM(CASE WHEN COALESCE("numCuota",0)>0 THEN 1 ELSE 0 END),0)::text cuotas
         FROM "PAGOS_TITULARES"
         WHERE "idPeople" IN (SELECT "_id" FROM "PEOPLE" WHERE "contrato"=$1 AND "tipoUsuario"='TITULAR')
           AND "validado"=true`, [K])).rows[0];
      const totalValidado = parseFloat(s.total) || 0;
      const saldo = Math.max(0, totalPlan - totalValidado);

      await c.query(
        `UPDATE "FINANCIEROS" SET "totalPlan"=$2,"valorCuota"=$3,"pagoInscripcion"=$4,"saldo"=$5,"cuotasPagadas"=$6,"_updatedDate"=NOW() WHERE "contrato"=$1`,
        [K, String(totalPlan), String(valorCuota), String(inscripcion), String(saldo), parseInt(s.cuotas, 10) || 0]);

      // cuota #0: saldo = totalPlan − inscripción; rellena montos si null
      const c0 = await c.query(
        `UPDATE "PAGOS_TITULARES"
            SET "saldo"=$2,
                "vlrTotalProg"=COALESCE("vlrTotalProg",$3),
                "valorCuota"=COALESCE("valorCuota",$4),
                "inscripcion"=COALESCE("inscripcion",$5),
                "_updatedDate"=NOW()
          WHERE "idPeople" IN (SELECT "_id" FROM "PEOPLE" WHERE "contrato"=$1 AND "tipoUsuario"='TITULAR')
            AND "numCuota"=0`,
        [K, Math.max(0, totalPlan - inscripcion), totalPlan, valorCuota, inscripcion]);
      cuota0Fix += (c0.rowCount || 0);

      await c.query('COMMIT');
      ok++;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      fail++;
      console.warn(`  ❌ ${K}: ${e.message}`);
    }
  }
  console.log(`\n🟢 APPLY: FINANCIEROS normalizados: ${ok} · fallidos: ${fail} · cuota#0 corregidas: ${cuota0Fix}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
