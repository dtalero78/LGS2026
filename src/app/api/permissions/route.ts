/**
 * API Route: /api/permissions
 * Gestión de permisos y roles del sistema
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role } from '@/types/permissions';
import { ROLE_PERMISSIONS_MATRIX, getPermissionsByRole } from '@/config/roles';
import { PERMISSIONS_CATALOG } from '@/config/permissions';
import { getPermissionsForRole } from '@/lib/custom-permissions';

/**
 * GET /api/permissions
 * Obtiene la matriz completa de permisos desde Wix
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role as Role;

    // Solo SUPER_ADMIN, ADMIN, o 'admin' (legacy) pueden ver la matriz completa
    const allowedRoles = [Role.SUPER_ADMIN, Role.ADMIN, 'admin' as Role];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    console.log('📊 Cargando permisos desde Wix...');

    // Cargar roles directamente desde Wix ROL_PERMISOS
    const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';
    const wixUrl = `${WIX_API_BASE_URL}/allRoles`;

    console.log('🔍 DEBUG: Intentando cargar desde:', wixUrl);
    console.log('🔍 DEBUG: WIX_API_BASE_URL env:', process.env.NEXT_PUBLIC_WIX_API_BASE_URL);

    try {
      const wixResponse = await fetch(wixUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
      });

      console.log('🔍 DEBUG: Wix response status:', wixResponse.status);
      console.log('🔍 DEBUG: Wix response ok:', wixResponse.ok);

      if (!wixResponse.ok) {
        throw new Error(`Wix API error: ${wixResponse.status}`);
      }

      const wixData = await wixResponse.json();
      console.log('🔍 DEBUG: Wix data success:', wixData.success);
      console.log('🔍 DEBUG: Wix roles count:', wixData.roles?.length);

      if (wixData.success && wixData.roles) {
        console.log(`✅ Cargados ${wixData.roles.length} roles desde Wix`);

        // Log TALERO specifically
        const taleroRole = wixData.roles.find((r: any) => r.rol === 'TALERO');
        console.log('🔍 DEBUG: TALERO permisos desde Wix:', taleroRole?.permisos);

        // Construir matriz con roles de Wix
        const matrix = wixData.roles.map((wixRole: any) => ({
          role: wixRole.rol,
          permissions: wixRole.permisos || [],
          count: (wixRole.permisos || []).length,
          descripcion: wixRole.descripcion,
          activo: wixRole.activo,
        }));

        // Obtener lista única de roles
        const roles = wixData.roles.map((r: any) => r.rol);

        return NextResponse.json(
          {
            success: true,
            source: 'wix',
            data: {
              roles,
              permissions: PERMISSIONS_CATALOG,
              matrix,
            },
          },
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          }
        );
      }
    } catch (wixError) {
      console.error('⚠️ Error al cargar desde Wix, usando fallback:', wixError);
    }

    // FALLBACK: Usar permisos hardcodeados si Wix falla
    console.log('⚠️ Usando permisos hardcodeados como fallback');
    const matrix = ROLE_PERMISSIONS_MATRIX.map((rolePerms) => {
      const permissions = getPermissionsForRole(rolePerms.role);
      return {
        role: rolePerms.role,
        permissions,
        count: permissions.length,
      };
    });

    return NextResponse.json(
      {
        success: true,
        source: 'fallback',
        data: {
          roles: Object.values(Role),
          permissions: PERMISSIONS_CATALOG,
          matrix,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error en GET /api/permissions:', error);
    return NextResponse.json(
      { error: 'Error al obtener permisos' },
      { status: 500 }
    );
  }
}
