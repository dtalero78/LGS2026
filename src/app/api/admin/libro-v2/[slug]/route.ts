import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { libroV2Service } from '@/services/libro-v2.service';

/**
 * GET/PATCH /api/admin/libro-v2/[slug] — interruptor de Book BEG / PRA / FUNC New (nacen APAGADOS).
 * Solo SUPER_ADMIN / ADMIN. El cambio aplica en ≤1 minuto (cache del flag).
 */
function exigirAdmin(session: any) {
  const role = String(session?.user?.role || '').toUpperCase();
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') throw new ForbiddenError('Solo administradores');
}

export const GET = handlerWithAuth(async (_req, ctx, session) => {
  exigirAdmin(session);
  return successResponse({ active: await libroV2Service.isActive(ctx.params.slug) });
});

export const PATCH = handlerWithAuth(async (req, ctx, session) => {
  exigirAdmin(session);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  await libroV2Service.setActive(ctx.params.slug, body.active, (session.user as any)?.email || 'admin');
  return successResponse({ active: body.active });
});
