import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { getFiltroConfig, setFiltroActivo } from '@/lib/filtro-advisors-chile';

/**
 * GET/PATCH /api/admin/filtro-advisors-chile — interruptor del filtro temporal de
 * capacitación (APP_CONFIG `filtro_advisors_chile`, ver src/lib/filtro-advisors-chile.ts).
 *   GET   → { active, emails }. Solo SUPER_ADMIN/ADMIN.
 *   PATCH → body { active: boolean }. Solo SUPER_ADMIN/ADMIN.
 * El cambio aplica en ≤1 minuto (cache del flag).
 */
function soloAdmin(session: any) {
  const rol = String(session?.user?.role || '').toUpperCase();
  if (rol !== 'SUPER_ADMIN' && rol !== 'ADMIN') throw new ForbiddenError('Solo SUPER_ADMIN o ADMIN');
}

export const GET = handlerWithStaffAuth(async (_req, _ctx, session) => {
  soloAdmin(session);
  const cfg = await getFiltroConfig(true);
  return successResponse({ active: cfg.activo, emails: cfg.emails });
});

export const PATCH = handlerWithStaffAuth(async (req, _ctx, session) => {
  soloAdmin(session);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  const cfg = await setFiltroActivo(body.active, (session.user as any)?.email || 'admin');
  return successResponse({ active: cfg.activo, emails: cfg.emails });
});
