import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { moraService } from '@/services/mora.service';

/**
 * GET/PATCH /api/admin/bloqueo-certificado-mora — interruptor del bloqueo de
 * certificados por mora (APP_CONFIG `bloqueo_certificado_mora_activo`).
 *   GET   → { active }. Cualquier usuario staff.
 *   PATCH → body { active: boolean }. Requiere MANTENIMIENTO.CONTRATOS.BLOQUEO_CERT_MORA.
 * El cambio aplica en ≤1 minuto (cache del flag).
 */
export const GET = handlerWithStaffAuth(async () => {
  return successResponse({ active: await moraService.isBloqueoActivo() });
});

export const PATCH = handlerWithStaffAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.BLOQUEO_CERT_MORA);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  await moraService.setBloqueoActivo(body.active, (session.user as any)?.email || 'admin');
  return successResponse({ active: body.active });
});
