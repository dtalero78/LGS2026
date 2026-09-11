import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { kidsConfigService } from '@/services/kids-config.service';

/**
 * GET/PATCH /api/admin/kids-config — interruptor del proceso Kids.
 *   GET   → { active }. Cualquier usuario autenticado (lo consulta el wizard de Crear Contrato).
 *   PATCH → body { active: boolean }. Requiere MANTENIMIENTO.CONTRATOS.KIDS_CONFIG.
 * El cambio aplica en ≤1 minuto (cache del flag).
 */
export const GET = handlerWithAuth(async (_req, _ctx, _session) => {
  return successResponse({ active: await kidsConfigService.isActive() });
});

export const PATCH = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.KIDS_CONFIG);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  const actor = (session.user as any)?.email || 'admin';
  await kidsConfigService.setActive(body.active, actor);
  return successResponse({ active: body.active });
});
