import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission, hasPermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { calcularLiquidacion } from '@/services/liquidacion-advisors.service';

/**
 * GET /api/postgres/administracion/liquidacion?periodo=YYYY-MM[&advisorId=]
 * Liquidación de horas LGS del mes (en vivo; el mes en curso es parcial).
 * Con advisorId devuelve además la lista de eventos de ese advisor.
 * Gate: GESTION_ADVISORS.VER; los valores ($) solo con VER_COMPENSACION.
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AdministracionPermission.GESTION_ADVISORS_VER);
  const sp = new URL(req.url).searchParams;
  const hoy = new Date().toISOString().slice(0, 7);
  const verValores = await hasPermission(session, AdministracionPermission.VER_COMPENSACION);
  const liq = await calcularLiquidacion(sp.get('periodo') || hoy, { verValores, advisorId: sp.get('advisorId') });
  return successResponse({ ...liq, verValores });
});
