/**
 * API Route: Invalidate permissions cache
 * Allows SUPER_ADMIN to invalidate the in-memory cache of role permissions
 */

import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError } from '@/lib/errors';
import { invalidatePermissionsCache } from '@/config/roles';
import { Role } from '@/types/permissions';

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any)?.role;

  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'admin') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede invalidar cache.');
  }

  const body = await req.json();
  const { role } = body;

  if (role) {
    invalidatePermissionsCache(role as Role);
    console.log(`✅ Cache invalidado para rol: ${role} por usuario ${session.user?.email}`);
    return successResponse({
      message: `Cache invalidado para ${role}. Los nuevos permisos se cargarán en el próximo request.`
    });
  }

  invalidatePermissionsCache();
  console.log(`✅ Cache completo invalidado por usuario ${session.user?.email}`);
  return successResponse({
    message: 'Cache completo invalidado. Los nuevos permisos se cargarán en el próximo request.'
  });
});
