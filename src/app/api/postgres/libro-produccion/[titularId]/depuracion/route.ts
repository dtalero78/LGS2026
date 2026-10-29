import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { previsualizarDepuracion } from '@/lib/libro-depuracion';

/**
 * GET /api/postgres/libro-produccion/[titularId]/depuracion
 * Vista previa de los modales Depurar / Ratificar: documentos y recibos a
 * descargar, pagos, otros contratos del titular y si la acción aplica.
 * Gate: staff + APROBACION.LIBRO_PRODUCCION.DEPURAR o .RATIFICAR.
 */
export const GET = handlerWithStaffAuth(async (_req, ctx, session) => {
  await requireAnyPermission(session, [AprobacionPermission.LIBRO_PRODUCCION_DEPURAR, AprobacionPermission.LIBRO_PRODUCCION_RATIFICAR]);
  return successResponse(await previsualizarDepuracion(ctx.params.titularId));
});
