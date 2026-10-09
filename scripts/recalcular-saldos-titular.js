/**
 * recalcular-saldos-titular.js
 *
 * Recalcula los saldos de un contrato después de un cambio MANUAL a un pago ya
 * validado (p. ej. editar valorPagado directo en la BD), con la misma regla que
 * usa la plataforma:
 *
 *   - PAGOS_TITULARES.saldo (validados) = saldo corrido del contrato después de
 *     cada pago: totalPlan − Σ(valorPagado + descuento), en orden fechaPago +
 *     _createdDate (igual que la tabla "Pagos del Titular" de la ficha).
 *   - PAGOS_TITULARES.valorAplicado (validados) = valorPagado.
 *   - FINANCIEROS.saldo ("Saldo a la Fecha") y cuotasPagadas = syncFinancieroSaldo().
 *
 * Los pagos pendientes de validar no se tocan.
 *
 * Uso:
 *   node scripts/recalcular-saldos-titular.js --contrato 01-15221-26            (dry-run)
 *   node scripts/recalcular-saldos-titular.js --contrato 01-15221-26 --apply    (escribe, en transacción)
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const contrato = args[args.indexOf('--contrato') + 1];
if (!args.includes('--contrato') || !contrato) {
  console.error('Uso: --contrato <numero> [--apply]');
  process.exit(1);
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query('BEGIN');
    const tit = (await c.query(
      `SELECT "_id" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' LIMIT 1`, [contrato])).rows[0];
    if (!tit) throw new Error(`No hay TITULAR para el contrato ${contrato}`);
    const fin = (await c.query(
      `SELECT "_id", "totalPlan", "saldo", "cuotasPagadas" FROM "FINANCIEROS" WHERE "contrato" = $1 LIMIT 1`, [contrato])).rows[0];
    if (!fin) throw new Error(`No hay FINANCIEROS para el contrato ${contrato}`);
    const totalPlan = num(fin.totalPlan);

    const pagos = (await c.query(
      `SELECT "_id", "numCuota", "fechaPago", "_createdDate", "valorPagado", "descuento", "saldo", "valorAplicado", "validado"
         FROM "PAGOS_TITULARES" WHERE "idPeople" = $1`, [tit._id])).rows;
    const key = (p) => (p.fechaPago ? new Date(p.fechaPago).toISOString().slice(0, 10) : '') +
      (p._createdDate ? new Date(p._createdDate).toISOString() : '');
    pagos.sort((a, b) => key(a).localeCompare(key(b)));

    let running = totalPlan;
    let pagado = 0;
    let cuotasPagadas = 0;
    const cambios = [];
    for (const p of pagos) {
      if (!p.validado) continue;
      const aplicado = num(p.valorPagado) + num(p.descuento);
      pagado += aplicado;
      if ((p.numCuota ?? 0) > 0) cuotasPagadas++;
      running = Math.max(0, running - aplicado);
      const nuevoSaldo = Number(running.toFixed(2));
      const nuevoAplicado = num(p.valorPagado);
      const fila = { cuota: p.numCuota, valorPagado: num(p.valorPagado), saldoAntes: num(p.saldo), saldoNuevo: nuevoSaldo,
        aplicadoAntes: num(p.valorAplicado), aplicadoNuevo: nuevoAplicado };
      if (fila.saldoAntes !== nuevoSaldo || fila.aplicadoAntes !== nuevoAplicado) {
        cambios.push(fila);
        await c.query(
          `UPDATE "PAGOS_TITULARES" SET "saldo" = $2, "valorAplicado" = $3, "_updatedDate" = NOW() WHERE "_id" = $1`,
          [p._id, nuevoSaldo, nuevoAplicado]);
      }
    }
    const saldoFin = String(Math.round(Math.max(0, totalPlan - pagado)));
    await c.query(
      `UPDATE "FINANCIEROS" SET "saldo" = $2, "cuotasPagadas" = $3, "_updatedDate" = NOW() WHERE "_id" = $1`,
      [fin._id, saldoFin, cuotasPagadas]);

    console.log(`Contrato ${contrato} — totalPlan ${totalPlan.toLocaleString('es-CL')}, pagado validado ${pagado.toLocaleString('es-CL')}`);
    console.table(cambios);
    console.log(`FINANCIEROS.saldo: ${fin.saldo} → ${saldoFin} · cuotasPagadas: ${fin.cuotasPagadas} → ${cuotasPagadas}`);

    if (APPLY) { await c.query('COMMIT'); console.log('✅ Aplicado.'); }
    else { await c.query('ROLLBACK'); console.log('(dry-run — nada escrito; use --apply)'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
