import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { cancelacionesService } from '@/services/cancelaciones.service';

/**
 * GET /api/postgres/cancelaciones-sin-reemplazo?vista=actual|historico
 */
export const GET = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, ServicioPermission.CANCELACION_SIN_REEMPLAZO_VER);
  const { searchParams } = new URL(request.url);
  const vista = searchParams.get('vista') === 'historico' ? 'historico' : 'actual';
  const data = await cancelacionesService.list(vista);
  return successResponse(data);
});
