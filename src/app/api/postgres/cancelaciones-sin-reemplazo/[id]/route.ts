import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { cancelacionesService } from '@/services/cancelaciones.service';

/**
 * PATCH /api/postgres/cancelaciones-sin-reemplazo/[id]
 *   body: { gestion, gestionadaPor? } — actualiza la gestión de un alumno.
 */
export const PATCH = handlerWithAuth(async (request, { params }, session) => {
  await requirePermission(session, ServicioPermission.CANCELACION_SIN_REEMPLAZO_VER);
  const body = await request.json();
  const row = await cancelacionesService.updateGestion(
    params.id,
    String(body?.gestion ?? ''),
    body?.gestionadaPor ?? null,
  );
  return successResponse({ row });
});
