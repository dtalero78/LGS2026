import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { guardarTarifa } from '@/services/gestion-advisors.service';

/**
 * PATCH /api/postgres/administracion/tarifas/[id]  Body: mismos campos que el POST.
 * Edita o desactiva (activo:false) una tarifa. No se borra: puede estar en liquidaciones.
 * Gate: ADMINISTRACION.GESTION_ADVISORS.TARIFAS.
 */
export const PATCH = handlerWithStaffAuth(async (req: NextRequest, ctx, session) => {
  await requirePermission(session, AdministracionPermission.TARIFAS);
  const body = await req.json().catch(() => ({}));
  await guardarTarifa(body, (session?.user as any)?.email || 'desconocido', ctx.params.id);
  return successResponse({ id: ctx.params.id });
});
