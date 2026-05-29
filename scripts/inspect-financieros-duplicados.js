// READ-ONLY: diagnóstico de contratos con MÁS DE UNA fila en FINANCIEROS.
// No modifica nada. Genera resumen en consola + CSV "financieros-duplicados.csv".
//   node scripts/inspect-financieros-duplicados.js
//
// Clasifica cada grupo (contrato) según si las CONDICIONES del contrato
// (totalPlan, valorCuota, pagoInscripcion, numeroCuotas) son iguales en todas
// las filas ("IDÉNTICO" → seguro dedupe dejando la más reciente) o difieren
// ("DIFIEREN" → revisar manual). saldo/cuotasPagadas pueden variar legítimamente.
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const num = (v) => (v === null || v === undefined || v === '') ? '' : String(v).replace(/[^0-9.-]/g, '');
const d = (v) => v ? new Date(v).toISOString().slice(0, 10) : '';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // contratos con >1 fila
  const dupContratos = await pool.query(`
    SELECT "contrato", COUNT(*)::int n FROM "FINANCIEROS"
    WHERE "contrato" IS NOT NULL AND TRIM("contrato") <> ''
    GROUP BY "contrato" HAVING COUNT(*) > 1`);
  const contratos = dupContratos.rows.map(r => r.contrato);

  if (!contratos.length) { console.log('No hay contratos con FINANCIEROS duplicado.'); await pool.end(); return; }

  // todas las filas de esos contratos
  const { rows } = await pool.query(`
    SELECT "_id","contrato","numeroId","primerNombre","primerApellido",
           "totalPlan","valorCuota","pagoInscripcion","numeroCuotas","cuotasPagadas",
           "saldo","fechaPago","estado","origen","_createdDate","_updatedDate"
    FROM "FINANCIEROS"
    WHERE "contrato" = ANY($1)
    ORDER BY "contrato", "_createdDate" ASC NULLS FIRST`, [contratos]);

  // agrupar por contrato
  const byContrato = new Map();
  for (const r of rows) {
    if (!byContrato.has(r.contrato)) byContrato.set(r.contrato, []);
    byContrato.get(r.contrato).push(r);
  }

  const termsKey = (r) => [num(r.totalPlan), num(r.valorCuota), num(r.pagoInscripcion), num(r.numeroCuotas)].join('|');

  let identicos = 0, difieren = 0, totalExtra = 0;
  const csv = [['contrato','clasificacion','fila','_id','titular','numeroId','totalPlan','valorCuota','pagoInscripcion','numeroCuotas','cuotasPagadas','saldo','fechaPago','estado','origen','creado','actualizado','recomendacion']];

  const detalle = [];
  for (const [contrato, fs2] of byContrato) {
    totalExtra += fs2.length - 1;
    const distinctTerms = new Set(fs2.map(termsKey));
    const clasificacion = distinctTerms.size === 1 ? 'IDÉNTICO' : 'DIFIEREN';
    if (clasificacion === 'IDÉNTICO') identicos++; else difieren++;

    // la "más reciente" por _createdDate (la que conservaría un dedupe)
    const sorted = [...fs2].sort((a, b) => new Date(b._createdDate || 0) - new Date(a._createdDate || 0));
    const keepId = sorted[0]._id;

    detalle.push({ contrato, clasificacion, n: fs2.length, titular: `${fs2[0].primerNombre||''} ${fs2[0].primerApellido||''}`.trim() });

    fs2.forEach((r, idx) => {
      const reco = clasificacion === 'DIFIEREN'
        ? 'REVISAR MANUAL (condiciones distintas)'
        : (r._id === keepId ? 'mantener (más reciente)' : 'candidato a borrar');
      csv.push([contrato, clasificacion, idx + 1, r._id, `${r.primerNombre||''} ${r.primerApellido||''}`.trim(), r.numeroId||'',
        num(r.totalPlan), num(r.valorCuota), num(r.pagoInscripcion), num(r.numeroCuotas), num(r.cuotasPagadas),
        num(r.saldo), d(r.fechaPago), r.estado||'', r.origen||'', d(r._createdDate), d(r._updatedDate), reco]);
    });
  }

  // resumen
  console.log('===== RESUMEN: FINANCIEROS duplicados por contrato =====');
  console.log(`  Contratos con >1 fila:            ${byContrato.size}`);
  console.log(`  Filas extra (a depurar):          ${totalExtra}`);
  console.log(`  Grupos IDÉNTICOS (terms iguales): ${identicos}  -> dedupe seguro (dejar la más reciente)`);
  console.log(`  Grupos que DIFIEREN (revisar):    ${difieren}`);
  console.log('');
  console.log('  Distribución por # de filas:');
  const porN = {};
  for (const [, fs2] of byContrato) porN[fs2.length] = (porN[fs2.length]||0)+1;
  Object.keys(porN).sort((a,b)=>a-b).forEach(k => console.log(`     ${k} filas: ${porN[k]} contratos`));
  console.log('');
  console.log('  Grupos que DIFIEREN (requieren decisión manual):');
  detalle.filter(x => x.clasificacion === 'DIFIEREN').sort((a,b)=>b.n-a.n)
    .forEach(x => console.log(`     ${x.contrato.padEnd(14)} ${x.n} filas | ${x.titular}`));

  // CSV
  const out = path.join(process.cwd(), 'financieros-duplicados.csv');
  const bom = '﻿';
  fs.writeFileSync(out, bom + csv.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(';')).join('\r\n'), 'utf8');
  console.log(`\n  CSV detallado: ${out}  (${csv.length - 1} filas)`);

  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
