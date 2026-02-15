import { handler, successResponse } from '@/lib/api-helpers';
import { RolPermisosRepository } from '@/repositories/roles.repository';
import { NotFoundError } from '@/lib/errors';

/**
 * GET /api/postgres/permissions
 */
export const GET = handler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const rol = searchParams.get('rol');

  if (rol) {
    const result = await RolPermisosRepository.findByRol(rol);
    if (!result) throw new NotFoundError('Role', rol);

    return successResponse({ rol: result.rol, permisos: result.permisos, descripcion: result.descripcion });
  }

  const roles = await RolPermisosRepository.findAll(true);
  return successResponse({ roles });
});
