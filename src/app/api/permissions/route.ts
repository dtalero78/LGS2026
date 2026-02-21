/**
 * API Route: /api/permissions
 * GET - Obtiene la matriz completa de permisos desde PostgreSQL
 */

import { NextResponse } from 'next/server';
import { handlerWithAuth } from '@/lib/api-helpers';
import { ForbiddenError } from '@/lib/errors';
import { Role } from '@/types/permissions';
import { ROLE_PERMISSIONS_MATRIX } from '@/config/roles';
import { PERMISSIONS_CATALOG } from '@/config/permissions';
import { getPermissionsForRole } from '@/lib/custom-permissions';
import { query } from '@/lib/postgres';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  const userRole = (session.user as any).role as Role;

  const allowedRoles = [Role.SUPER_ADMIN, Role.ADMIN, 'admin' as Role];
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError('Permisos insuficientes');
  }

  console.log('📊 [PostgreSQL] Cargando permisos...');

  try {
    const result = await query(
      `SELECT "rol", "permisos", "descripcion", "activo"
       FROM "ROL_PERMISOS"
       ORDER BY "rol" ASC`
    );

    if (result.rowCount === 0) {
      throw new Error('No roles found in database');
    }

    console.log(`✅ [PostgreSQL] Cargados ${result.rowCount} roles`);

    const matrix = result.rows.map((row: any) => ({
      role: row.rol,
      permissions: row.permisos || [],
      count: (row.permisos || []).length,
      descripcion: row.descripcion,
      activo: row.activo,
    }));

    const roles = result.rows.map((r: any) => r.rol);

    return NextResponse.json(
      { success: true, source: 'postgres', data: { roles, permissions: PERMISSIONS_CATALOG, matrix } },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (dbError) {
    console.error('⚠️ [PostgreSQL] Error al cargar permisos, usando fallback:', dbError);

    const matrix = ROLE_PERMISSIONS_MATRIX.map((rolePerms) => {
      const permissions = getPermissionsForRole(rolePerms.role);
      return { role: rolePerms.role, permissions, count: permissions.length };
    });

    return NextResponse.json(
      { success: true, source: 'fallback', data: { roles: Object.values(Role), permissions: PERMISSIONS_CATALOG, matrix } },
      { headers: NO_CACHE_HEADERS }
    );
  }
});
