/**
 * API Route: /api/permissions/update
 * Actualiza los permisos de un rol específico en WIX
 * NUEVA VERSIÓN: Guarda en Wix ROL_PERMISOS (NO en archivo)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role, Permission } from '@/types/permissions';
import { invalidatePermissionsCache } from '@/config/roles';

/**
 * POST /api/permissions/update
 * Body: { role: Role, permissions: Permission[] }
 *
 * IMPORTANTE: Esta funcionalidad actualiza la tabla ROL_PERMISOS en Wix
 * Solo disponible para SUPER_ADMIN
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🔐 POST /api/permissions/update - Starting...');

    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      console.log('❌ No session found');
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role as Role;
    console.log('👤 User role:', userRole);

    // Solo SUPER_ADMIN o 'admin' (legacy) puede modificar permisos
    if (userRole !== Role.SUPER_ADMIN && userRole !== 'admin') {
      console.log('❌ Permission denied for role:', userRole);
      return NextResponse.json(
        { error: 'Solo SUPER_ADMIN puede modificar permisos', currentRole: userRole },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { role, permissions } = body;

    if (!role || !permissions) {
      return NextResponse.json(
        { error: 'Faltan parámetros: role y permissions son requeridos' },
        { status: 400 }
      );
    }

    if (!Object.values(Role).includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido' },
        { status: 400 }
      );
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'permissions debe ser un array' },
        { status: 400 }
      );
    }

    // Validar que no hay permisos undefined o inválidos
    const invalidPerms = permissions.filter(p => !p || p === 'undefined' || p === undefined || typeof p !== 'string');
    if (invalidPerms.length > 0) {
      console.error('❌ Permisos inválidos detectados:', invalidPerms);
      console.error('❌ Array completo de permisos:', permissions);
      return NextResponse.json(
        {
          error: 'Algunos permisos son inválidos (undefined o vacíos)',
          details: `${invalidPerms.length} permisos inválidos de ${permissions.length} total`,
          invalidPermissions: invalidPerms,
          hint: 'Esto puede ocurrir si el catálogo de permisos tiene enums incorrectos. Recarga /admin/permissions e intenta nuevamente.'
        },
        { status: 400 }
      );
    }

    console.log(`🔄 Actualizando permisos de ${role} en Wix (${permissions.length} permisos)`);
    console.log(`📋 Permisos a guardar:`, permissions);

    // 1. Actualizar permisos en Wix
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
      console.error('❌ Error al actualizar en Wix:', result.error);
      return NextResponse.json(
        {
          error: 'Error al actualizar permisos en Wix',
          details: result.error
        },
        { status: 500 }
      );
    }

    // 2. Invalidar cache para que próxima petición use datos frescos
    invalidatePermissionsCache(role as Role);
    console.log('🗑️ Cache invalidado para', role);

    console.log('✅ Permisos actualizados exitosamente en Wix');
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅  PERMISOS ACTUALIZADOS SIN DEPLOY');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Rol: ${role}`);
    console.log(`Permisos: ${permissions.length}`);
    console.log('Guardado en: Wix tabla ROL_PERMISOS');
    console.log('Cache: Invalidado - Próximo request carga datos frescos');
    console.log('');
    console.log('✅ NO necesitas hacer deploy ni commit');
    console.log('✅ Los cambios se aplican INMEDIATAMENTE');
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');

    return NextResponse.json({
      success: true,
      message: `✅ Permisos de ${role} actualizados en Wix sin deploy`,
      data: {
        role,
        permissions,
        count: permissions.length,
        storage: 'Wix ROL_PERMISOS',
        cacheInvalidated: true
      },
    });
  } catch (error) {
    console.error('Error en POST /api/permissions/update:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        error: 'Error al actualizar permisos',
        details: errorMessage,
        hint: 'Verifica que Wix esté disponible y que la tabla ROL_PERMISOS exista'
      },
      { status: 500 }
    );
  }
}
