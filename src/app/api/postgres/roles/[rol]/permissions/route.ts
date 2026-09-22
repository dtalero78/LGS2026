import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { RolPermisosRepository } from '@/repositories/roles.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { invalidateApiPermissionsCache } from '@/lib/api-permissions';
import { invalidatePermissionsCache } from '@/lib/middleware-permissions';

/**
 * GET /api/postgres/roles/[rol]/permissions
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const rol = decodeURIComponent(params.rol);
  const roleData = await RolPermisosRepository.findByRol(rol);

  if (!roleData) throw new NotFoundError('Role', rol);

  return successResponse({
    rol: roleData.rol, permisos: roleData.permisos || [],
    descripcion: roleData.descripcion, activo: roleData.activo,
  });
});

/**
 * PUT /api/postgres/roles/[rol]/permissions
 */
export const PUT = handlerWithAuth(async (request, { params }) => {
  const body = await request.json();
  const { permisos, descripcion } = body;
  const rol = decodeURIComponent(params.rol);

  if (!permisos || !Array.isArray(permisos)) throw new ValidationError('permisos array is required');

  const existing = await RolPermisosRepository.findByRol(rol);
  if (!existing) throw new NotFoundError('Role', rol);

  const role = await RolPermisosRepository.updatePermisos(rol, permisos, descripcion);

  // Invalidar AMBOS cachés en memoria para que el cambio aplique de inmediato:
  //  - api-permissions → gate de las rutas API (requirePermission)
  //  - middleware-permissions → acceso a rutas del dashboard + menú
  invalidateApiPermissionsCache(rol);
  try { invalidatePermissionsCache(rol as any); } catch { /* best-effort */ }

  return successResponse({ message: `Permissions updated for role ${rol}`, role, permissionsCount: permisos.length });
});
