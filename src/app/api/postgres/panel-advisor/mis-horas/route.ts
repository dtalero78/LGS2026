import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { NotFoundError } from '@/lib/errors';
import { calcularLiquidacion } from '@/services/liquidacion-advisors.service';
import { listarCortes, advisorDeSesion } from '@/services/liq-flujo.service';

/**
 * GET /api/postgres/panel-advisor/mis-horas?periodo=YYYY-MM
 * Horas del advisor de la SESIÓN (nunca de otro): por semana, tipo y corte, ajustes con
 * su motivo y estado de su factura. SOLO HORAS: sin tarifas, valores ni inconsistencias
 * de valor (decisión 2026-11-03).
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  const adv = await advisorDeSesion((session?.user as any)?.email || '');
  if (!adv) throw new NotFoundError('Ficha de advisor de su usuario', (session?.user as any)?.email || '');
  const periodo = new URL(req.url).searchParams.get('periodo') || new Date().toISOString().slice(0, 7);
  const liq = await calcularLiquidacion(periodo, { verValores: true, advisorId: adv._id });
  const cortes = await listarCortes(periodo, liq, adv._id);
  const sinValores = liq.advisors.map(({ valor, cortes: cs, reparto, ...a }) => ({ ...a, cortes: cs.map((c) => ({ corte: c.corte, horas: c.horas })) }));
  return successResponse({
    periodo, parcial: liq.parcial, semanas: liq.semanas, advisor: { nombre: adv.nombre, pais: adv.pais, tipoContratacion: adv.tipoContratacion },
    liquidaciones: sinValores,
    cortes: cortes.map((c) => ({
      programa: c.programa, corte: c.corte, estado: c.estado, requiereFactura: c.requiereFactura, plazo: c.plazo, plazoReenvio: c.plazoReenvio,
      horas: c.horas,
      ajustes: c.ajustes.map((x) => ({ fecha: x.fecha, concepto: x.concepto, horas: x.horas, motivo: x.motivo, alcance: x.alcance, semanaInicio: x.semanaInicio })),
      factura: c.factura ? { _id: c.factura._id, nombre: c.factura.nombre, estado: c.factura.estado, subidoEn: c.factura.subidoEn, comentarioDevolucion: c.factura.comentarioDevolucion } : null,
    })),
  });
});
