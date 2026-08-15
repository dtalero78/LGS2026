import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { cancelacionesService } from '@/services/cancelaciones.service';

/**
 * POST /api/postgres/cancelaciones-sin-reemplazo/gestionar
 *   Botón global "Gestionada": pasa todos los registros actuales a histórico.
 *   Solo procede si NINGÚN registro actual está en 'SIN_GESTION'.
 */
export const POST = handlerWithAuth(async (_request, _ctx, session) => {
  await requirePermission(session, ServicioPermission.CANCELACION_SIN_REEMPLAZO_VER);
  const data = await cancelacionesService.gestionarTodas();
  return successResponse(data);
});
