/**
 * API Route: /api/roles/create
 * Crea un nuevo rol en Wix ROL_PERMISOS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role } from '@/types/permissions';
import { invalidatePermissionsCache } from '@/config/roles';

/**
 * POST /api/roles/create
 * Body: { rol: string, descripcion: string, permisos?: string[] }
 *
 * Crea un nuevo rol en la tabla ROL_PERMISOS de Wix
 * Solo disponible para SUPER_ADMIN
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🔐 POST /api/roles/create - Starting...');

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

    // Solo SUPER_ADMIN o 'admin' (legacy) puede crear roles
    if (userRole !== Role.SUPER_ADMIN && userRole !== 'admin') {
      console.log('❌ Permission denied for role:', userRole);
      return NextResponse.json(
        { error: 'Solo SUPER_ADMIN puede crear roles', currentRole: userRole },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { rol, descripcion, permisos } = body;

    if (!rol || !descripcion) {
      return NextResponse.json(
        { error: 'Faltan parámetros: rol y descripcion son requeridos' },
        { status: 400 }
      );
    }

    // Validar que el rol no exista ya
    const checkResponse = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/wix-proxy/role-permissions?rol=${encodeURIComponent(rol)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }
    );

    const checkResult = await checkResponse.json();

    if (checkResult.success && checkResult.rol) {
      return NextResponse.json(
        { error: 'El rol ya existe', rol: checkResult.rol },
        { status: 409 }
      );
    }

    console.log(`🔄 Creando nuevo rol ${rol} en Wix`);

    // Crear rol en Wix
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/wix-proxy/create-role`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol,
          descripcion,
          permisos: permisos || [],
          activo: true,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      console.error('❌ Error al crear rol en Wix:', result.error);
      return NextResponse.json(
        {
          error: 'Error al crear rol en Wix',
          details: result.error
        },
        { status: 500 }
      );
    }

    // Invalidar cache completo
    invalidatePermissionsCache();
    console.log('🗑️ Cache completo invalidado');

    console.log('✅ Rol creado exitosamente en Wix');

    return NextResponse.json({
      success: true,
      message: `✅ Rol ${rol} creado en Wix exitosamente`,
      data: {
        rol,
        descripcion,
        permisos: permisos || [],
        activo: true,
      },
    });
  } catch (error) {
    console.error('Error en POST /api/roles/create:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error: 'Error al crear rol',
        details: errorMessage,
        hint: 'Verifica que Wix esté disponible y que la tabla ROL_PERMISOS exista'
      },
      { status: 500 }
    );
  }
}
