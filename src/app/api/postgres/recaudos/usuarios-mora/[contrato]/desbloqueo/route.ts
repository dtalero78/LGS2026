import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { RecaudosPermission } from '@/types/permissions';
import { moraService } from '@/services/mora.service';

/**
 * POST   /api/postgres/recaudos/usuarios-mora/[contrato]/desbloqueo  body { motivo }
 *        → desbloquea el certificado del contrato aunque esté en mora.
 * DELETE /api/postgres/recaudos/usuarios-mora/[contrato]/desbloqueo
 *        → revoca el desbloqueo (activo=false; nunca se borra).
 * Gateado por RECAUDOS.USUARIOS_MORA.DESBLOQUEAR. Auditoría en CERTIFICADO_DESBLOQUEOS.
 */
export const POST = handlerWithStaffAuth(async (req, { params }, session) => {
  await requirePermission(session, RecaudosPermission.USUARIOS_MORA_DESBLOQUEAR);
  const contrato = decodeURIComponent(params.contrato || '');
  const body = await req.json().catch(() => ({}));
  const user = session.user as any;
  const desbloqueo = await moraService.desbloquear(contrato, body?.motivo, { email: user?.email || 'desconocido', nombre: user?.name });
  return successResponse({ desbloqueo });
});

export const DELETE = handlerWithStaffAuth(async (_req, { params }, session) => {
  await requirePermission(session, RecaudosPermission.USUARIOS_MORA_DESBLOQUEAR);
  const contrato = decodeURIComponent(params.contrato || '');
  await moraService.revocarDesbloqueo(contrato, (session.user as any)?.email || 'desconocido');
  return successResponse({ ok: true });
});
