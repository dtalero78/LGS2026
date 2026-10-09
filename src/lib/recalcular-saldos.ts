import 'server-only';
import type { PoolClient } from 'pg';

/**
 * Recalcula los saldos de un titular después de ajustar un pago YA VALIDADO
 * (Recaudos › Gestión › Ajustes). Misma regla que el resto de la plataforma:
 *
 *   - PAGOS_TITULARES.saldo (validados) = saldo corrido del contrato después de
 *     cada pago: totalPlan − Σ(valorPagado + descuento), en orden fechaPago +
 *     _createdDate (el mismo que usa la tabla "Pagos del Titular" de la ficha).
 *   - PAGOS_TITULARES.valorAplicado (validados) = valorPagado.
 *   - FINANCIEROS.saldo ("Saldo a la Fecha") y cuotasPagadas, igual que
 *     syncFinancieroSaldo() de pagos-titulares.service.
 *
 * Los pagos pendientes no se tocan. Corre dentro de la transacción del caller.
 * Script equivalente para casos sueltos: scripts/recalcular-saldos-titular.js
 */
function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function recalcularSaldosTitular(
  client: PoolClient,
  idPeople: string,
): Promise<{ contrato: string | null; saldo: string | null }> {
  const per = (await client.query(`SELECT "contrato" FROM "PEOPLE" WHERE "_id" = $1`, [idPeople])).rows[0];
  const contrato: string | null = per?.contrato ?? null;
  if (!contrato) return { contrato: null, saldo: null };
  const fin = (await client.query(
    `SELECT "_id", "totalPlan" FROM "FINANCIEROS" WHERE "contrato" = $1 LIMIT 1`, [contrato])).rows[0];
  if (!fin) return { contrato, saldo: null };
  const totalPlan = num(fin.totalPlan);

  const pagos = (await client.query(
    `SELECT "_id", "numCuota", "fechaPago", "_createdDate", "valorPagado", "descuento", "saldo", "valorAplicado"
       FROM "PAGOS_TITULARES" WHERE "idPeople" = $1 AND "validado" = true`, [idPeople])).rows;
  const key = (p: any) => (p.fechaPago ? new Date(p.fechaPago).toISOString().slice(0, 10) : '') +
    (p._createdDate ? new Date(p._createdDate).toISOString() : '');
  pagos.sort((a, b) => key(a).localeCompare(key(b)));

  let running = totalPlan;
  let pagado = 0;
  let cuotasPagadas = 0;
  for (const p of pagos) {
    const aplicado = num(p.valorPagado) + num(p.descuento);
    pagado += aplicado;
    if ((p.numCuota ?? 0) > 0) cuotasPagadas++;
    running = Math.max(0, running - aplicado);
    const saldo = Number(running.toFixed(2));
    const valorAplicado = num(p.valorPagado);
    if (num(p.saldo) !== saldo || num(p.valorAplicado) !== valorAplicado) {
      await client.query(
        `UPDATE "PAGOS_TITULARES" SET "saldo" = $2, "valorAplicado" = $3, "_updatedDate" = NOW() WHERE "_id" = $1`,
        [p._id, saldo, valorAplicado]);
    }
  }
  // Entero sin decimales: la ficha parsea el saldo con parseCurrency (punto = miles).
  const saldo = String(Math.round(Math.max(0, totalPlan - pagado)));
  await client.query(
    `UPDATE "FINANCIEROS" SET "saldo" = $2, "cuotasPagadas" = $3, "_updatedDate" = NOW() WHERE "_id" = $1`,
    [fin._id, saldo, cuotasPagadas]);
  return { contrato, saldo };
}
