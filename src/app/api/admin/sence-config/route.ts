import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { senceFeatureService } from '@/services/sence-feature.service';

/**
 * GET/PATCH /api/admin/sence-config — interruptor del proceso SENCE.
 *   GET   → { active }. Cualquier usuario autenticado (lo consulta el /me del panel).
 *   PATCH → body { active: boolean }. Requiere MANTENIMIENTO.CONTINGENCIA.SENCE_CONFIG.
 * El cambio aplica en ≤1 minuto (cache del flag).
 */
export const GET = handlerWithAuth(async (_req, _ctx, _session) => {
  return successResponse({ active: await senceFeatureService.isActive() });
});

export const PATCH = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.SENCE_CONFIG);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  const actor = (session.user as any)?.email || 'admin';
  await senceFeatureService.setActive(body.active, actor);
  return successResponse({ active: body.active });
});
