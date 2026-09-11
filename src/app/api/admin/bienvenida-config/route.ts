import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { bienvenidaConfigService } from '@/services/bienvenida-config.service';

/**
 * GET/PATCH /api/admin/bienvenida-config — interruptor de la página de bienvenida.
 *   GET   → { active }. Cualquier usuario autenticado.
 *   PATCH → body { active: boolean }. Requiere MANTENIMIENTO.CONTRATOS.BIENVENIDA_CONFIG.
 * El cambio aplica en ≤1 minuto (cache del flag).
 */
export const GET = handlerWithAuth(async (_req, _ctx, _session) => {
  return successResponse({ active: await bienvenidaConfigService.isActive() });
});

export const PATCH = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.BIENVENIDA_CONFIG);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  const actor = (session.user as any)?.email || 'admin';
  await bienvenidaConfigService.setActive(body.active, actor);
  return successResponse({ active: body.active });
});
