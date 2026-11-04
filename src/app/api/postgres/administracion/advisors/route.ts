import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission, hasPermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { listarAdvisorsPago } from '@/services/gestion-advisors.service';

/**
 * GET /api/postgres/administracion/advisors → ficha de pago de todos los advisors.
 * Gate: GESTION_ADVISORS.VER o FICHA_PAGO. Valor fijo y horas contratadas solo con VER_COMPENSACION.
 */
export const GET = handlerWithStaffAuth(async (_req: NextRequest, _ctx, session) => {
  await requireAnyPermission(session, [AdministracionPermission.GESTION_ADVISORS_VER, AdministracionPermission.FICHA_PAGO]);
  const verCompensacion = await hasPermission(session, AdministracionPermission.VER_COMPENSACION);
  return successResponse({ advisors: await listarAdvisorsPago({ verCompensacion }), verCompensacion });
});
