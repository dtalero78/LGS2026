import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { bookEssService } from '@/services/book-ess.service';

/**
 * GET/PATCH /api/admin/book-ess — interruptor "Book ESS New" (nace APAGADO).
 * Solo SUPER_ADMIN / ADMIN. El cambio aplica en ≤1 minuto (cache del flag).
 */
function exigirAdmin(session: any) {
  const role = String(session?.user?.role || '').toUpperCase();
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') throw new ForbiddenError('Solo administradores');
}

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  exigirAdmin(session);
  return successResponse({ active: await bookEssService.isActive() });
});

export const PATCH = handlerWithAuth(async (req, _ctx, session) => {
  exigirAdmin(session);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  await bookEssService.setActive(body.active, (session.user as any)?.email || 'admin');
  return successResponse({ active: body.active });
});
