/**
 * API Route: /api/roles/create
 * POST - Crea un nuevo rol en PostgreSQL ROL_PERMISOS
 * Solo disponible para SUPER_ADMIN
 */

import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError, ConflictError } from '@/lib/errors';
import { Role } from '@/types/permissions';
import { invalidatePermissionsCache } from '@/config/roles';
import { RolPermisosRepository } from '@/repositories/roles.repository';

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any).role as Role;

  if (userRole !== Role.SUPER_ADMIN && userRole !== Role.ADMIN) {
    throw new ForbiddenError('Solo SUPER_ADMIN puede crear roles');
  }

  const body = await req.json();
  const { rol, descripcion, permisos } = body;

  if (!rol || !descripcion) {
    throw new ValidationError('Faltan parámetros: rol y descripcion son requeridos');
  }

  const existing = await RolPermisosRepository.findByRol(rol);
  if (existing) throw new ConflictError('El rol ya existe');

  console.log(`🔄 Creando nuevo rol ${rol}`);

  const newRole = await RolPermisosRepository.create(rol, permisos || [], descripcion, true);

  invalidatePermissionsCache();
  console.log(`✅ Rol ${rol} creado. Cache invalidado.`);

  return successResponse({
    message: `Rol ${rol} creado exitosamente`,
    role: newRole,
  });
});
