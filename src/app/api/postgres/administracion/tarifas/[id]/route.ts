import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { guardarTarifa, borrarTarifa } from '@/services/gestion-advisors.service';

/**
 * PATCH  /api/postgres/administracion/tarifas/[id]  Body: mismos campos que el POST. Edita o desactiva.
 * DELETE /api/postgres/administracion/tarifas/[id]  Borra la tarifa (los cortes verificados/pagados
 *        conservan su valor en el snapshot; los abiertos se recalculan).
 * Gate: ADMINISTRACION.GESTION_ADVISORS.TARIFAS.
 */
export const PATCH = handlerWithStaffAuth(async (req: NextRequest, ctx, session) => {
  await requirePermission(session, AdministracionPermission.TARIFAS);
  const body = await req.json().catch(() => ({}));
  await guardarTarifa(body, (session?.user as any)?.email || 'desconocido', ctx.params.id);
  return successResponse({ id: ctx.params.id });
});

export const DELETE = handlerWithStaffAuth(async (_req: NextRequest, ctx, session) => {
  await requirePermission(session, AdministracionPermission.TARIFAS);
  await borrarTarifa(ctx.params.id, (session?.user as any)?.email || 'desconocido');
  return successResponse({ id: ctx.params.id });
});
