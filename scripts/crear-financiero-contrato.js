/**
 * crear-financiero-contrato.js
 *
 * Crea el registro de FINANCIEROS y la "cuota #0" (inscripción) de un contrato
 * que no los tiene (contratos viejos o migrados sin datos financieros), con los
 * datos del formulario "Datos Financieros" del contrato. Luego recalcula los
 * saldos del titular con la misma regla que recalcularSaldosTitular()
 * (src/lib/recalcular-saldos.ts): FINANCIEROS.saldo = totalPlan − Σ(validados).
 *
 * Mismas columnas que crea POST /api/postgres/contracts. Aborta si el contrato ya
 * tiene FINANCIEROS o ya tiene cuota #0 (no pisa nada).
 *
 * Uso (dry-run por defecto):
 *   node scripts/crear-financiero-contrato.js --contrato 01-8383-25 \
 *     --total 1260000 --inscripcion 90000 --cuotas 13 --valor-cuota 90000 \
 *     --fecha-pago 2025-09-05 --fecha-inscripcion 2025-08-05 \
 *     --medio Transferencia --vigencia 12 --plan Credito \
 *     [--validar] [--apply]
 *
 *   --fecha-pago        fecha del primer pago (corte de cuotas) → FINANCIEROS.fechaPago
 *   --fecha-inscripcion fecha de la cuota #0 (pago de la inscripción, normalmente la firma)
 *   --validar           la cuota #0 nace VALIDADA (cuenta en el saldo). Sin el flag nace
 *                       PENDIENTE y aparece en Recaudos › Verificación Inscripción.
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const APPLY = argv.includes('--apply');
const VALIDAR = argv.includes('--validar');

const contrato = opt('contrato');
const total = Number(opt('total'));
const inscripcion = Number(opt('inscripcion'));
const cuotas = parseInt(opt('cuotas'), 10);
const valorCuota = Number(opt('valor-cuota'));
const fechaPago = opt('fecha-pago');
const fechaInscripcion = opt('fecha-inscripcion');
const medio = opt('medio');
const vigencia = opt('vigencia');
const plan = opt('plan');

const fecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const faltan = [];
if (!contrato) faltan.push('--contrato');
if (!(total > 0)) faltan.push('--total');
if (!(inscripcion >= 0)) faltan.push('--inscripcion');
if (!(cuotas >= 0)) faltan.push('--cuotas');
if (!(valorCuota >= 0)) faltan.push('--valor-cuota');
if (!fecha(fechaPago)) faltan.push('--fecha-pago YYYY-MM-DD');
if (!fecha(fechaInscripcion)) faltan.push('--fecha-inscripcion YYYY-MM-DD');
if (!medio) faltan.push('--medio');
if (!vigencia) faltan.push('--vigencia');
if (!plan) faltan.push('--plan');
if (faltan.length) { console.error('Faltan/erróneos:', faltan.join(', ')); process.exit(1); }

const rid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const tit = (await c.query(
      `SELECT "_id","numeroId","primerNombre","primerApellido","plataforma","gestorRecaudo","aprobacion"
         FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'`, [contrato])).rows;
    if (tit.length !== 1) throw new Error(`Se esperaba 1 titular en ${contrato}, hay ${tit.length}`);
    const t = tit[0];
    const fin = (await c.query(`SELECT "_id" FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato])).rows;
    if (fin.length) throw new Error(`${contrato} ya tiene FINANCIEROS (${fin[0]._id}); no se crea otro`);
    const c0 = (await c.query(`SELECT "_id" FROM "PAGOS_TITULARES" WHERE "idPeople" = $1 AND "numCuota" = 0`, [t._id])).rows;
    if (c0.length) throw new Error(`${contrato} ya tiene cuota #0 (${c0[0]._id})`);

    const saldoPlan = Math.round(total - inscripcion);
    const finRow = {
      _id: rid('fin'), contrato, numeroId: t.numeroId, primerNombre: (t.primerNombre || '').trim(), primerApellido: (t.primerApellido || '').trim(),
      totalPlan: String(total), valorCuota: String(valorCuota), pagoInscripcion: String(inscripcion), numeroCuotas: cuotas,
      fechaPago, medioPago: medio, vigencia: String(vigencia), titularId: t._id, plan,
    };
    const pagoRow = {
      _id: rid('pag'), idPeople: t._id, numeroId: t.numeroId, gestorRecaudo: t.gestorRecaudo, plataforma: t.plataforma,
      fechaPago: fechaInscripcion, numCuota: 0, cuotasTotal: cuotas, vlrTotalProg: total, valorCuota,
      valorPagado: inscripcion, inscripcion, saldo: saldoPlan, medioPago: medio, validado: VALIDAR, plan,
    };

    console.log(`\n=== ${contrato} · titular ${finRow.primerNombre} ${finRow.primerApellido} (${t.numeroId}) · ${t.aprobacion} · ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
    console.log('\nFINANCIEROS a crear:'); console.table([finRow]);
    console.log(`\nCuota #0 a crear (${VALIDAR ? 'VALIDADA' : 'PENDIENTE de validar en Recaudos'}):`); console.table([pagoRow]);

    await c.query('BEGIN');
    await c.query(
      `INSERT INTO "FINANCIEROS" ("_id","contrato","numeroId","primerNombre","primerApellido","totalPlan","valorCuota",
          "pagoInscripcion","numeroCuotas","cuotasPagadas","saldo","fechaPago","medioPago","vigencia","titularId","plan",
          "origen","_createdDate","_updatedDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11::date,$12,$13,$14,$15,'POSTGRES',NOW(),NOW())`,
      [finRow._id, contrato, finRow.numeroId, finRow.primerNombre, finRow.primerApellido, finRow.totalPlan, finRow.valorCuota,
       finRow.pagoInscripcion, cuotas, String(saldoPlan), fechaPago, medio, finRow.vigencia, t._id, plan]);
    await c.query(
      `INSERT INTO "PAGOS_TITULARES" ("_id","idPeople","numeroId","gestorRecaudo","plataforma",
          "fechaPago","fechaVencimiento","numCuota","cuotasTotal","vlrTotalProg","valorCuota","valorPagado","inscripcion",
          "saldo","descuento","valorAplicado","medioPago","documentosAdjuntos","validado","fechaValidacion","validadoPor",
          "createdBy","tipoCartera","plan","_createdDate","_updatedDate")
       VALUES ($1,$2,$3,$4,$5,$6::date,$6::date,0,$7,$8,$9,$10,$10,$11,0,$10,$12,'[]'::jsonb,$13,
          CASE WHEN $13 THEN CURRENT_DATE END, CASE WHEN $13 THEN 'script:crear-financiero-contrato' END,
          'script:crear-financiero-contrato','normal',$14,NOW(),NOW())`,
      [pagoRow._id, t._id, t.numeroId, t.gestorRecaudo, t.plataforma, fechaInscripcion, cuotas, total, valorCuota,
       inscripcion, saldoPlan, medio, VALIDAR, plan]);

    // Recalcular saldos (misma regla que recalcularSaldosTitular).
    const pagos = (await c.query(
      `SELECT "_id","numCuota","fechaPago","_createdDate","valorPagado","descuento","saldo","valorAplicado"
         FROM "PAGOS_TITULARES" WHERE "idPeople" = $1 AND "validado" = true`, [t._id])).rows;
    const key = (p) => (p.fechaPago ? new Date(p.fechaPago).toISOString().slice(0, 10) : '') + (p._createdDate ? new Date(p._createdDate).toISOString() : '');
    pagos.sort((a, b) => key(a).localeCompare(key(b)));
    let running = total, pagado = 0, cuotasPagadas = 0;
    const cambios = [];
    for (const p of pagos) {
      const aplicado = num(p.valorPagado) + num(p.descuento);
      pagado += aplicado;
      if ((p.numCuota ?? 0) > 0) cuotasPagadas++;
      running = Math.max(0, running - aplicado);
      const saldo = Number(running.toFixed(2));
      if (num(p.saldo) !== saldo || num(p.valorAplicado) !== num(p.valorPagado)) {
        cambios.push({ pago: p._id, numCuota: p.numCuota, fechaPago: key(p).slice(0, 10), valorPagado: num(p.valorPagado), saldoAntes: num(p.saldo), saldoNuevo: saldo });
        await c.query(`UPDATE "PAGOS_TITULARES" SET "saldo" = $2, "valorAplicado" = $3, "_updatedDate" = NOW() WHERE "_id" = $1`, [p._id, saldo, num(p.valorPagado)]);
      }
    }
    const saldoFinal = String(Math.round(Math.max(0, total - pagado)));
    await c.query(`UPDATE "FINANCIEROS" SET "saldo" = $2, "cuotasPagadas" = $3, "_updatedDate" = NOW() WHERE "_id" = $1`, [finRow._id, saldoFinal, cuotasPagadas]);
    console.log(`\nPagos validados del titular: ${pagos.length} · pagado ${pagado} · Saldo a la Fecha → ${saldoFinal} · cuotasPagadas ${cuotasPagadas}`);
    if (cambios.length) { console.log('Saldo corrido de pagos validados que se ajusta:'); console.table(cambios); }

    if (APPLY) { await c.query('COMMIT'); console.log('\n✅ Aplicado.'); }
    else { await c.query('ROLLBACK'); console.log('\nDRY-RUN: nada se guardó (use --apply).'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
