#!/usr/bin/env node
/**
 * backfill-cuota0-todos.js — Igual que backfill-cuota0-inscripcion.js pero SIN
 * CSV: recorre TODOS los TITULARES (excluye PRB-) que NO tienen la fila
 * numCuota=0 en PAGOS_TITULARES y les crea la "cuota #0" (= inscripción) con los
 * datos del contrato.
 *
 * Además, por cada cuota #0 creada, sella PEOPLE.fechaIngreso = fecha de pago de
 * la inscripción (= inicioContrato) en el TITULAR y TODOS los beneficiarios del
 * contrato (decisión del usuario para estos contratos viejos).
 *
 * Replica la lógica de /api/postgres/contracts (cuota #0):
 *   numCuota=0, validado=true, valorPagado=inscripcion, inscripcion=inscripcion,
 *   vlrTotalProg=totalPlan, cuotasTotal=numeroCuotas, tipoCartera='normal',
 *   fechaPago = PEOPLE.inicioContrato (fallback fechaContrato).
 *
 * Buckets (se OMITE y reporta, no se escribe):
 *   - yaTiene            → ya tiene cuota #0 (no debería entrar; guard extra)
 *   - sinFinanciero      → no hay fila en FINANCIEROS para el contrato
 *   - sinInscripcion     → pagoInscripcion <= 0
 *   - inscripcionSospechosa → inscripción < 1000 (ej. "90" por "90.000")
 *   - sinFechaInicio     → no hay inicioContrato ni fechaContrato
 *
 * USO:
 *   node scripts/backfill-cuota0-todos.js            # dry-run (no escribe)
 *   node scripts/backfill-cuota0-todos.js --apply    # aplica
 *   node scripts/backfill-cuota0-todos.js --apply --no-sync
 * REQUISITO: IP en Trusted Sources de la BD managed + .env.local con DATABASE_URL.
 */
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const NO_SYNC = process.argv.includes('--no-sync');
const REPORT = 'docs/cuota0-todos-report.csv';
const INSCRIPCION_MIN = 1000;
const VALIDADO_POR = 'migracion-cuota0';
const CREATED_BY = 'script:backfill-cuota0-todos';

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
const csvLine = a => a.map(x => { const s = String(x ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';');

(async () => {
  console.log(`\n===== BACKFILL CUOTA #0 — TODOS (${APPLY ? 'APPLY' : 'DRY-RUN'}${NO_SYNC ? ' --no-sync' : ''}) =====`);
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await client.connect();

  // Titulares SIN cuota #0 + su FINANCIEROS (más reciente por contrato)
  const { rows: titulares } = await client.query(
    `SELECT p."_id", p."numeroId", p."contrato", p."gestorRecaudo", p."plataforma", p."plan",
            p."inicioContrato", p."fechaContrato", p."primerNombre", p."primerApellido",
            f."pagoInscripcion", f."totalPlan", f."valorCuota", f."numeroCuotas",
            f."medioPago", f."plan" AS "finPlan"
     FROM "PEOPLE" p
     LEFT JOIN LATERAL (
       SELECT "pagoInscripcion","totalPlan","valorCuota","numeroCuotas","medioPago","plan"
       FROM "FINANCIEROS" ff WHERE ff."contrato" = p."contrato"
       ORDER BY ff."_createdDate" DESC LIMIT 1
     ) f ON true
     WHERE p."tipoUsuario" = 'TITULAR'
       AND COALESCE(p."contrato",'') <> ''
       AND COALESCE(p."contrato",'') NOT LIKE 'PRB-%'
       AND NOT EXISTS (SELECT 1 FROM "PAGOS_TITULARES" pt WHERE pt."idPeople" = p."_id" AND pt."numCuota" = 0)`
  );
  console.log(`Titulares SIN cuota #0: ${titulares.length}`);

  const buckets = { crear: [], sinFinanciero: [], sinInscripcion: [], inscripcionSospechosa: [], sinFechaInicio: [] };
  for (const t of titulares) {
    if (t.pagoInscripcion === null && t.totalPlan === null) { buckets.sinFinanciero.push({ t }); continue; }
    const inscripcion = parseMoney(t.pagoInscripcion);
    if (inscripcion <= 0) { buckets.sinInscripcion.push({ t }); continue; }
    if (inscripcion < INSCRIPCION_MIN) { buckets.inscripcionSospechosa.push({ t, inscripcion }); continue; }
    const fechaPago = toDateStr(t.inicioContrato) || toDateStr(t.fechaContrato);
    if (!fechaPago) { buckets.sinFechaInicio.push({ t, inscripcion }); continue; }
    const totalPlan = Math.round(parseMoney(t.totalPlan));
    buckets.crear.push({ t, inscripcion, fechaPago, totalPlan });
  }

  const n = k => buckets[k].length;
  console.log(`\n── Resumen ──`);
  console.log(`  ✅ crear cuota #0:          ${n('crear')}`);
  console.log(`  ⏭️  sin FINANCIEROS:         ${n('sinFinanciero')}`);
  console.log(`  ⏭️  sin inscripción (<=0):   ${n('sinInscripcion')}`);
  console.log(`  ⚠️  inscripción sospechosa:  ${n('inscripcionSospechosa')}  (<${INSCRIPCION_MIN}, corregir FINANCIEROS primero)`);
  console.log(`  ⏭️  sin fecha inicio:        ${n('sinFechaInicio')}`);

  // Reporte CSV
  fs.writeFileSync(REPORT, '﻿' + [
    csvLine(['accion', 'contrato', 'titular', 'peopleId', 'inscripcion', 'fechaPago', 'totalPlan']),
    ...buckets.crear.map(({ t, inscripcion, fechaPago, totalPlan }) => csvLine(['CREAR', t.contrato, `${t.primerNombre || ''} ${t.primerApellido || ''}`.trim(), t._id, inscripcion, fechaPago, totalPlan])),
    ...buckets.sinFinanciero.map(({ t }) => csvLine(['SIN_FINANCIERO', t.contrato, `${t.primerNombre || ''} ${t.primerApellido || ''}`.trim(), t._id, '', '', ''])),
    ...buckets.sinInscripcion.map(({ t }) => csvLine(['SIN_INSCRIPCION', t.contrato, `${t.primerNombre || ''} ${t.primerApellido || ''}`.trim(), t._id, '', '', ''])),
    ...buckets.inscripcionSospechosa.map(({ t, inscripcion }) => csvLine(['INSCRIPCION_SOSPECHOSA', t.contrato, `${t.primerNombre || ''} ${t.primerApellido || ''}`.trim(), t._id, inscripcion, '', ''])),
    ...buckets.sinFechaInicio.map(({ t, inscripcion }) => csvLine(['SIN_FECHA_INICIO', t.contrato, `${t.primerNombre || ''} ${t.primerApellido || ''}`.trim(), t._id, inscripcion, '', ''])),
  ].join('\r\n'), 'utf8');
  console.log(`\nReporte detallado: ${REPORT}`);

  let creados = 0, fallidos = 0, fechaIngresoRows = 0;
  if (APPLY && buckets.crear.length) {
    for (const { t, inscripcion, fechaPago, totalPlan } of buckets.crear) {
      try {
        await client.query('BEGIN');
        const ex = await client.query(`SELECT 1 FROM "PAGOS_TITULARES" WHERE "idPeople"=$1 AND "numCuota"=0 LIMIT 1`, [t._id]);
        if (ex.rowCount > 0) { await client.query('ROLLBACK'); continue; }

        const cuotasTotal = parseInt(String(t.numeroCuotas ?? 0), 10) || 0;
        const valorCuota = parseMoney(t.valorCuota);
        const saldo = Math.max(0, Math.round(totalPlan - inscripcion));
        const plan = t.plan || t.finPlan || null;

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
           t.medioPago || null, VALIDADO_POR, CREATED_BY, plan]);

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

        // Sella fechaIngreso = fecha de pago de la inscripción en el TITULAR y
        // TODOS los beneficiarios del contrato (decisión del usuario para estos
        // contratos viejos: la fecha de ingreso = fecha de la inscripción).
        const fi = await client.query(
          `UPDATE "PEOPLE" SET "fechaIngreso" = $1::date, "_updatedDate" = NOW() WHERE "contrato" = $2`,
          [fechaPago, t.contrato]);
        fechaIngresoRows += (fi.rowCount || 0);

        await client.query('COMMIT');
        creados++;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        fallidos++;
        console.warn(`  ❌ ${t.contrato} (${t._id}): ${e.message}`);
      }
    }
    console.log(`\n🟢 APPLY: cuota #0 creadas: ${creados}  ·  fallidas: ${fallidos}  ·  PEOPLE con fechaIngreso sellada: ${fechaIngresoRows}`);
  } else if (!APPLY) {
    console.log(`\n🟡 DRY-RUN — no se escribió nada. Para aplicar: node scripts/backfill-cuota0-todos.js --apply`);
  }

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
