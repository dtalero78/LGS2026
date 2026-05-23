import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError } from '@/lib/errors';
import { findPegados } from '@/services/usuarios-pegados.service';

/**
 * GET /api/admin/scripts/usuarios-pegados?force=1
 *
 * Lista de estudiantes activos cuyo step actual está por debajo del step
 * real calculado a partir de sus bookings. Cacheado server-side por 30 min.
 *
 * Acceso: SUPER_ADMIN y ADMIN.
 */
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  const role = (session.user as any)?.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN/ADMIN puede consultar usuarios pegados');
  }

  const force = new URL(req.url).searchParams.get('force') === '1';
  const result = await findPegados({ force });
  return successResponse(result);
});
