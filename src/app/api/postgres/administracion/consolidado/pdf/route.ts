import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { handlerWithStaffAuth } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ConflictError } from '@/lib/errors';
import { AdministracionPermission } from '@/types/permissions';
import { calcularLiquidacion } from '@/services/liquidacion-advisors.service';
import { listarCortes } from '@/services/liq-flujo.service';
import { buildConsolidadoPdf, type FilaPdf } from '@/lib/consolidado-advisors-pdf';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TIPO: Record<string, string> = { POR_HORAS: 'Por horas', SEMIPLANTA: 'Semiplanta', PLANTA: 'Planta' };

/**
 * GET /api/postgres/administracion/consolidado/pdf?periodo=YYYY-MM
 * PDF del Consolidado con los valores CONGELADOS al verificar. Solo cuando TODOS los
 * cortes que se liquidan están VERIFICADOS o PAGADOS. Gate: CONSOLIDADO_IMPRIMIR.
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AdministracionPermission.CONSOLIDADO_IMPRIMIR);
  const periodo = new URL(req.url).searchParams.get('periodo') || new Date().toISOString().slice(0, 7);
  const liq = await calcularLiquidacion(periodo, { verValores: true });
  const cortes = await listarCortes(periodo, liq);
  const aLiquidar = cortes.filter((c) => c.estado !== 'SIN_HORAS');
  const pendientes = aLiquidar.filter((c) => c.estado !== 'VERIFICADO' && c.estado !== 'PAGADO');
  if (pendientes.length) throw new ConflictError(`Faltan ${pendientes.length} corte(s) por verificar: el Consolidado se imprime cuando todos estén VERIFICADOS.`);

  const tc = (aLiquidar.find((c) => c.snapshot?.tipoCambio)?.snapshot?.tipoCambio) || liq.tipoCambio;
  const usd = (v: number, mon: string) => mon === 'USD' ? v : mon === 'COP' ? (tc.COP ? v / tc.COP : null) : (tc.CLP ? v / tc.CLP : null);
  const filas: FilaPdf[] = [];
  const porPais = new Map<string, { horas: number; usd: number }>();
  for (const c of aLiquidar) {
    const a = liq.advisors.find((x) => x.advisorId === c.advisorId && x.programaLiq === c.programa);
    if (!a) continue;
    const s = c.snapshot || {};
    const valor = Number(s.valor ?? c.valor ?? 0); const mon = s.moneda || c.moneda;
    const enUsd = usd(valor, mon);
    filas.push({ programa: c.programa, pais: a.pais, nombre: a.nombre, tipo: TIPO[a.tipoContratacion] || a.tipoContratacion, corte: c.corte,
      horas: Number(s.horas ?? c.horas), valor, moneda: mon, usd: enUsd, estado: c.estado, verificadoPor: c.verificadoPor });
    // Carga a cada país según el reparto de las horas del advisor (Perú dentro de Ecuador).
    const rep = s.reparto || a.reparto; const tot = Object.values(rep as Record<string, number>).reduce((x, y) => x + y, 0) || 1;
    for (const [p, h] of Object.entries(rep as Record<string, number>)) {
      const acc = porPais.get(p) || { horas: 0, usd: 0 };
      acc.horas += Number(s.horas ?? c.horas) * (h / tot); acc.usd += (enUsd || 0) * (h / tot);
      porPais.set(p, acc);
    }
  }
  filas.sort((x, y) => x.programa.localeCompare(y.programa) || x.pais.localeCompare(y.pais) || x.nombre.localeCompare(y.nombre));
  const [yy, mm] = periodo.split('-').map(Number);
  let logoPath: string | null = null;
  try { const p = path.join(process.cwd(), 'public', 'logo.png'); if (fs.existsSync(p)) logoPath = p; } catch { /* opcional */ }
  const pdf = await buildConsolidadoPdf({
    periodoEtiqueta: `${MESES[mm - 1]} ${yy}`, generadoPor: (session?.user as any)?.email || '', generadoEn: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    logoPath, tipoCambio: { COP: tc.COP ?? null, CLP: tc.CLP ?? null, fecha: tc.fecha ?? null },
    porPais: ['Chile', 'Colombia', 'Ecuador'].map((p) => ({ pais: p, ...(porPais.get(p) || { horas: 0, usd: 0 }) })),
    filas,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="consolidado-advisors-${periodo}.pdf"`, 'Cache-Control': 'no-store' },
  });
});
