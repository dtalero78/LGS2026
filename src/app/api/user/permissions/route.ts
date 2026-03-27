/**
 * API Route: /api/user/permissions
 * GET - Devuelve los permisos del usuario actual desde PostgreSQL
 */

import { NextResponse } from 'next/server';
import { handlerWithAuth } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { Role } from '@/types/permissions';
import { RolPermisosRepository } from '@/repositories/roles.repository';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  const userRole = (session.user as any).role as Role;

  if (!userRole) {
    throw new ValidationError('Usuario sin rol asignado');
  }

  console.log(`🔐 [PostgreSQL] Cargando permisos para rol: ${userRole}`);

  try {
    const roleData = await RolPermisosRepository.findByRol(userRole);

    if (!roleData) {
      console.warn(`⚠️ [PostgreSQL] Rol ${userRole} no encontrado`);
      return NextResponse.json(
        { success: true, source: 'postgres', role: userRole, permissions: [], count: 0 },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const permissions = roleData.permisos || [];

    console.log(`✅ [PostgreSQL] Permisos cargados para ${userRole}:`, permissions.length);

    return NextResponse.json(
      { success: true, source: 'postgres', role: userRole, permissions, count: permissions.length },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (dbError) {
    console.error('❌ [PostgreSQL] Error al cargar permisos:', dbError);

    const { getPermissionsByRole } = await import('@/config/roles');
    const fallbackPermissions = getPermissionsByRole(userRole);

    console.log(`⚠️ Usando permisos fallback para ${userRole}:`, fallbackPermissions.length);

    return NextResponse.json(
      { success: true, source: 'fallback', role: userRole, permissions: fallbackPermissions, count: fallbackPermissions.length },
      { headers: NO_CACHE_HEADERS }
    );
  }
});
