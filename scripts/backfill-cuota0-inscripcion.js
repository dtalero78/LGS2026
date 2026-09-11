#!/usr/bin/env node
/**
 * backfill-cuota0-inscripcion.js — Crea la "cuota #0" (= pago de inscripción)
 * en PAGOS_TITULARES para contratos viejos que tienen FINANCIEROS.pagoInscripcion
 * pero NO tienen aún la fila numCuota=0 (anteriores a la integración de pagos).
 *
 * Replica la lógica de creación de /api/postgres/contracts (cuota #0):
 *   numCuota=0, validado=true, valorPagado=inscripcion, inscripcion=inscripcion,
 *   vlrTotalProg=totalPlan, cuotasTotal=numeroCuotas, tipoCartera='normal'.
 *
 * Decisiones del usuario:
 *   - Si ya existe la cuota #0 → se OMITE (idempotente).
 *   - Si no hay inscripción (o no hay FINANCIEROS) → se OMITE y se reporta.
 *   - fechaPago = fecha de INICIO del contrato (PEOPLE.inicioContrato; fallback
 *     fechaContrato). Si no hay ninguna de las dos → se OMITE y se reporta
 *     (no se inventa fecha en un registro financiero).
 *
 * Match contra PEOPLE (tipoUsuario='TITULAR'): exacto por contrato → por core
 * (recupera prefijo 01- faltante). Solo cédula o ambiguo → NO se escribe, se
 * reporta para revisión manual.
 *
 * Tras crear, recalcula FINANCIEROS.saldo/cuotasPagadas (syncFinancieroSaldo)
 * salvo --no-sync. Para contratos con solo la inscripción es no-op.
 *
 * USO:
 *   node scripts/backfill-cuota0-inscripcion.js            # dry-run (no escribe)
 *   node scripts/backfill-cuota0-inscripcion.js --apply    # aplica
 *   node scripts/backfill-cuota0-inscripcion.js --apply --no-sync
 * REQUISITO: IP en Trusted Sources de la BD managed + .env.local con DATABASE_URL.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const csvArg = process.argv.find(a => a.startsWith('--csv='));
const CSV = csvArg ? csvArg.slice('--csv='.length) : path.join('docs', 'Cuota0CL.csv');
const REPORT = path.basename(CSV).replace(/\.csv$/i, '') + '-report.csv';
const APPLY = process.argv.includes('--apply');
const NO_SYNC = process.argv.includes('--no-sync');

const VALIDADO_POR = 'migracion-cuota0';
const CREATED_BY = 'script:backfill-cuota0';

// --- helpers de normalización (mismos que match-asignaciones-recaudos) ---
const normContrato = s => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
const coreContrato = s => normContrato(s).replace(/^\d{2}-/, ''); // ignora prefijo país 01-
const normCedula = s => String(s || '').trim().toUpperCase().replace(/[.\-\s]/g, '');
function parseMoney(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function toDateStr(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
const newPagoId = () => `pag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// --- parse CSV (';', latin1, comillas dobles) ---
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else { if (c === '"') q = true; else if (c === ';') { f.push(cur); cur = ''; } else cur += c; }
    }
    f.push(cur);
    rows.push(f);
  }
  return rows;
}

(async () => {
  const raw = fs.readFileSync(CSV, 'latin1');
  const rows = parseCsv(raw);
  const header = rows.shift();
  // Mapeo de columnas por nombre de header (tolera distinto orden entre CSVs).
  const norm = h => String(h || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const H = header.map(norm);
  const colContrato = H.findIndex(h => h === 'contrato');
  const colTitular  = H.findIndex(h => h.includes('titular'));
  const colCedula   = H.findIndex(h => /cedula|documento|numero id|^id$/.test(h));
  if (colContrato < 0) { console.error('ERROR: no se encontró columna "Contrato" en el header:', header.join(';')); process.exit(1); }
  const recs = rows
    .map((r, i) => ({
      num: String(i + 1),
      contrato: (r[colContrato] || '').trim(),
      titular: colTitular >= 0 ? (r[colTitular] || '').trim() : '',
      cedula:  colCedula  >= 0 ? (r[colCedula]  || '').trim() : '',
    }))
    .filter(r => r.contrato);
  console.log(`\n===== BACKFILL CUOTA #0 (${APPLY ? 'APPLY' : 'DRY-RUN'}${NO_SYNC ? ' --no-sync' : ''}) =====`);
  console.log(`CSV: ${CSV}  ·  filas de datos: ${recs.length}`);

  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await client.connect();

  // 1) Titulares
  const { rows: titulares } = await client.query(
    `SELECT "_id","numeroId","contrato","gestorRecaudo","plataforma","plan",
            "inicioContrato","fechaContrato","primerNombre","primerApellido"
     FROM "PEOPLE" WHERE "tipoUsuario" = 'TITULAR'`);
  const byContrato = new Map(), byCore = new Map(), byCedula = new Map();
  for (const t of titulares) {
    const kc = normContrato(t.contrato); if (kc) (byContrato.get(kc) || byContrato.set(kc, []).get(kc)).push(t);
    const kk = coreContrato(t.contrato); if (kk) (byCore.get(kk) || byCore.set(kk, []).get(kk)).push(t);
    const kd = normCedula(t.numeroId);   if (kd) (byCedula.get(kd) || byCedula.set(kd, []).get(kd)).push(t);
  }

  // 2) idPeople que YA tienen cuota #0
  const { rows: c0 } = await client.query(`SELECT DISTINCT "idPeople" FROM "PAGOS_TITULARES" WHERE "numCuota" = 0`);
  const tieneCuota0 = new Set(c0.map(r => r.idPeople));

  // 3) FINANCIEROS más reciente por contrato
  const { rows: fins } = await client.query(
    `SELECT DISTINCT ON ("contrato") "contrato","pagoInscripcion","totalPlan","valorCuota",
            "numeroCuotas","saldo","medioPago","plan"
     FROM "FINANCIEROS" ORDER BY "contrato", "_createdDate" DESC NULLS LAST`);
  const finByContrato = new Map(fins.map(f => [normContrato(f.contrato), f]));
  const finByCore = new Map();
  for (const f of fins) { const k = coreContrato(f.contrato); if (k) (finByCore.get(k) || finByCore.set(k, []).get(k)).push(f); }

  // 4) suma de pagos validados ya existentes por titular (para proyectar saldo)
  const { rows: sums } = await client.query(
    `SELECT "idPeople", COALESCE(SUM(COALESCE("valorPagado",0)+COALESCE("descuento",0)),0)::text total
     FROM "PAGOS_TITULARES" WHERE "validado" = true GROUP BY "idPeople"`);
  const sumValidado = new Map(sums.map(s => [s.idPeople, parseFloat(s.total) || 0]));

  // --- clasificación ---
  const INSCRIPCION_MIN = 1000; // < esto = dato sospechoso (ej. "90" por "90.000")
  const buckets = { crear: [], yaTiene: [], sinFinanciero: [], sinInscripcion: [], inscripcionSospechosa: [], sinFechaInicio: [], noEncontrado: [], ambiguo: [], soloCedula: [] };
  for (const r of recs) {
    const exact = byContrato.get(normContrato(r.contrato)) || [];
    let t = null;
    if (exact.length === 1) t = exact[0];
    else if (exact.length > 1) { buckets.ambiguo.push({ r, t: exact }); continue; }
    else {
      const core = byCore.get(coreContrato(r.contrato)) || [];
      if (core.length === 1) t = core[0];
      else if (core.length > 1) { buckets.ambiguo.push({ r, t: core }); continue; }
      else {
        const ced = byCedula.get(normCedula(r.cedula)) || [];
        if (ced.length >= 1) { buckets.soloCedula.push({ r, t: ced }); continue; }
        buckets.noEncontrado.push({ r }); continue;
      }
    }
    if (tieneCuota0.has(t._id)) { buckets.yaTiene.push({ r, t }); continue; }
    let fin = finByContrato.get(normContrato(t.contrato));
    if (!fin) { const fc = finByCore.get(coreContrato(t.contrato)) || []; if (fc.length === 1) fin = fc[0]; }
    if (!fin) { buckets.sinFinanciero.push({ r, t }); continue; }
    const inscripcion = parseMoney(fin.pagoInscripcion);
    if (inscripcion <= 0) { buckets.sinInscripcion.push({ r, t, fin }); continue; }
    if (inscripcion < INSCRIPCION_MIN) { buckets.inscripcionSospechosa.push({ r, t, fin, inscripcion }); continue; }
    const fechaPago = toDateStr(t.inicioContrato) || toDateStr(t.fechaContrato);
    if (!fechaPago) { buckets.sinFechaInicio.push({ r, t, fin, inscripcion }); continue; }

    const totalPlan = parseMoney(fin.totalPlan);
    const saldoAntes = parseMoney(fin.saldo);
    const saldoDespues = Math.max(0, Math.round(totalPlan - ((sumValidado.get(t._id) || 0) + inscripcion)));
    buckets.crear.push({ r, t, fin, inscripcion, fechaPago, totalPlan, saldoAntes, saldoDespues });
  }

  // --- resumen ---
  const n = k => buckets[k].length;
  console.log(`\n-- Clasificación --`);
  console.log(`  ✅ a crear cuota #0:        ${n('crear')}`);
  console.log(`  ⏭️  ya tiene cuota #0:       ${n('yaTiene')}`);
  console.log(`  ⚠️  sin FINANCIEROS:         ${n('sinFinanciero')}`);
  console.log(`  ⚠️  sin inscripción (>0):    ${n('sinInscripcion')}`);
  console.log(`  ⚠️  inscripción sospechosa:  ${n('inscripcionSospechosa')}  (<${INSCRIPCION_MIN}, corregir FINANCIEROS — no se escribe)`);
  console.log(`  ⚠️  sin fecha inicio:        ${n('sinFechaInicio')}`);
  console.log(`  🟡 solo match x cédula:     ${n('soloCedula')}  (revisar — no se escribe)`);
  console.log(`  🔴 contrato ambiguo:        ${n('ambiguo')}  (revisar — no se escribe)`);
  console.log(`  ❌ no encontrado:           ${n('noEncontrado')}`);
  const saldoCambia = buckets.crear.filter(x => x.saldoAntes !== x.saldoDespues);
  console.log(`\n  de los "a crear": ${saldoCambia.length} cambiarían el saldo (revisa el CSV).`);

  // --- reportes ---
  const csvLine = a => a.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',');
  const dump = (file, hdr, lines) => fs.writeFileSync(path.join('docs', file), '﻿' + [csvLine(hdr), ...lines].join('\r\n'), 'utf8');
  dump(REPORT,
    ['num', 'accion', 'contratoCSV', 'contratoBD', 'titular', 'peopleId', 'inscripcion', 'fechaPago', 'saldoAntes', 'saldoDespues'],
    [
      ...buckets.crear.map(({ r, t, inscripcion, fechaPago, saldoAntes, saldoDespues }) =>
        csvLine(['CREAR', r.num, r.contrato, t.contrato, `${t.primerNombre || ''} ${t.primerApellido || ''}`.trim(), t._id, inscripcion, fechaPago, saldoAntes, saldoDespues])),
      ...buckets.yaTiene.map(({ r, t }) => csvLine(['YA_TIENE_CUOTA0', r.num, r.contrato, t.contrato, r.titular, t._id, '', '', '', ''])),
      ...buckets.sinFinanciero.map(({ r, t }) => csvLine(['SIN_FINANCIERO', r.num, r.contrato, t.contrato, r.titular, t._id, '', '', '', ''])),
      ...buckets.sinInscripcion.map(({ r, t }) => csvLine(['SIN_INSCRIPCION', r.num, r.contrato, t.contrato, r.titular, t._id, '0', '', '', ''])),
      ...buckets.inscripcionSospechosa.map(({ r, t, inscripcion }) => csvLine(['INSCRIPCION_SOSPECHOSA', r.num, r.contrato, t.contrato, r.titular, t._id, inscripcion, '', '', ''])),
      ...buckets.sinFechaInicio.map(({ r, t, inscripcion }) => csvLine(['SIN_FECHA_INICIO', r.num, r.contrato, t.contrato, r.titular, t._id, inscripcion, '', '', ''])),
      ...buckets.soloCedula.map(({ r, t }) => csvLine(['SOLO_CEDULA', r.num, r.contrato, t.map(x => x.contrato).join(' | '), r.titular, t.map(x => x._id).join(' | '), '', '', '', ''])),
      ...buckets.ambiguo.map(({ r, t }) => csvLine(['AMBIGUO', r.num, r.contrato, t.map(x => x.contrato).join(' | '), r.titular, t.map(x => x._id).join(' | '), '', '', '', ''])),
      ...buckets.noEncontrado.map(({ r }) => csvLine(['NO_ENCONTRADO', r.num, r.contrato, '', r.titular, '', '', '', '', ''])),
    ]);
  console.log(`\nReporte detallado: docs/${REPORT}`);

  // --- APPLY ---
  let creados = 0, fallidos = 0;
  if (APPLY && buckets.crear.length) {
    for (const item of buckets.crear) {
      const { t, fin, inscripcion, fechaPago, totalPlan } = item;
      try {
        await client.query('BEGIN');
        // re-chequeo idempotente dentro de la transacción
        const ex = await client.query(`SELECT 1 FROM "PAGOS_TITULARES" WHERE "idPeople"=$1 AND "numCuota"=0 LIMIT 1`, [t._id]);
        if (ex.rowCount > 0) { await client.query('ROLLBACK'); buckets.yaTiene.push(item); continue; }

        const cuotasTotal = parseInt(String(fin.numeroCuotas ?? 0), 10) || 0;
        const valorCuota = parseMoney(fin.valorCuota);
        const saldo = Math.max(0, Math.round(totalPlan - inscripcion));
        const plan = t.plan || fin.plan || null;

        await client.query(
          `INSERT INTO "PAGOS_TITULARES" (
             "_id","idPeople","numeroId","gestorRecaudo","plataforma",
             "fechaPago","fechaVencimiento","numCuota","cuotasTotal","vlrTotalProg",
             "valorCuota","valorPagado","inscripcion","saldo","descuento",
             "medioPago","documentosAdjuntos",
             "validado","fechaValidacion","validadoPor",
             "createdBy","tipoCartera","plan","_createdDate","_updatedDate"
           ) VALUES (
             $1,$2,$3,$4,$5,
             $6::date,$6::date,0,$7,$8,
             $9,$10,$10,$11,0,
             $12,'[]'::jsonb,
             true,$6::date,$13,
             $14,'normal',$15,NOW(),NOW()
           )`,
          [newPagoId(), t._id, t.numeroId, t.gestorRecaudo || null, t.plataforma || null,
           fechaPago, cuotasTotal, totalPlan, valorCuota, inscripcion, saldo,
           fin.medioPago || null, VALIDADO_POR, CREATED_BY, plan]);

        // sync FINANCIEROS.saldo/cuotasPagadas (salvo --no-sync)
        if (!NO_SYNC) {
          const s = await client.query(
            `SELECT COALESCE(SUM(COALESCE("valorPagado",0)+COALESCE("descuento",0)),0)::text total,
                    COALESCE(SUM(CASE WHEN COALESCE("numCuota",0)>0 THEN 1 ELSE 0 END),0)::text cuotas
             FROM "PAGOS_TITULARES" WHERE "idPeople"=$1 AND "validado"=true`, [t._id]);
          const nuevoSaldo = Math.max(0, Math.round(totalPlan - (parseFloat(s.rows[0].total) || 0)));
          await client.query(
            `UPDATE "FINANCIEROS" SET "saldo"=$1,"cuotasPagadas"=$2,"_updatedDate"=NOW() WHERE "contrato"=$3`,
            [String(nuevoSaldo), parseInt(s.rows[0].cuotas, 10) || 0, t.contrato]);
        }
        await client.query('COMMIT');
        creados++;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        fallidos++;
        console.warn(`  ❌ ${t.contrato} (${t._id}): ${e.message}`);
      }
    }
    console.log(`\n🟢 APPLY: cuota #0 creadas: ${creados}  ·  fallidas: ${fallidos}`);
  } else if (!APPLY) {
    console.log(`\n🟡 DRY-RUN — no se escribió nada. Para aplicar: node scripts/backfill-cuota0-inscripcion.js --csv=${CSV} --apply`);
  }

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
