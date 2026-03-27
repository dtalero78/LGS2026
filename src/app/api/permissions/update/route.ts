/**
 * API Route: /api/permissions/update
 * POST - Actualiza los permisos de un rol específico en PostgreSQL ROL_PERMISOS
 * Solo disponible para SUPER_ADMIN
 */

import { NextResponse } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { Role, PersonPermission, StudentPermission, AcademicoPermission, ServicioPermission, ComercialPermission, AprobacionPermission } from '@/types/permissions';
import { invalidatePermissionsCache } from '@/config/roles';

const VALID_PERMISSIONS = new Set<string>([
  ...Object.values(PersonPermission),
  ...Object.values(StudentPermission),
  ...Object.values(AcademicoPermission),
  ...Object.values(ServicioPermission),
  ...Object.values(ComercialPermission),
  ...Object.values(AprobacionPermission),
]);

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any).role as Role;

  if (userRole !== Role.SUPER_ADMIN && userRole !== 'admin') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede modificar permisos');
  }

  const body = await req.json();
  const { role, permissions } = body;

  if (!role || !permissions) {
    throw new ValidationError('Faltan parámetros: role y permissions son requeridos');
  }

  if (!Object.values(Role).includes(role)) {
    throw new ValidationError('Rol inválido');
  }

  if (!Array.isArray(permissions)) {
    throw new ValidationError('permissions debe ser un array');
  }

  const invalidPerms = permissions.filter((p: any) => !p || p === 'undefined' || p === undefined || typeof p !== 'string');
  if (invalidPerms.length > 0) {
    console.error('❌ Permisos inválidos detectados:', invalidPerms);
    throw new ValidationError(
      `Algunos permisos son inválidos: ${invalidPerms.length} de ${permissions.length} total`
    );
  }

  const unknownPerms = permissions.filter((p: string) => !VALID_PERMISSIONS.has(p));
  if (unknownPerms.length > 0) {
    console.error('❌ Permisos desconocidos detectados:', unknownPerms);
    throw new ValidationError(
      `Permisos no reconocidos: ${unknownPerms.join(', ')}`
    );
  }

  console.log(`🔄 Actualizando permisos de ${role} (${permissions.length} permisos)`);

  const response = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/postgres/roles`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol: role, permisos: permissions }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    console.error('❌ Error al actualizar permisos:', result.error);
    return NextResponse.json(
      { error: 'Error al actualizar permisos', details: result.error },
      { status: 500 }
    );
  }

  invalidatePermissionsCache(role as Role);
  console.log(`✅ Permisos de ${role} actualizados. Cache invalidado.`);

  return successResponse({
    message: `Permisos de ${role} actualizados exitosamente`,
    data: {
      role,
      permissions,
      count: permissions.length,
      storage: 'PostgreSQL ROL_PERMISOS',
      cacheInvalidated: true
    },
  });
});
