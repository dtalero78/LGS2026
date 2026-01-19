/**
 * API Route: Invalidate permissions cache
 * Allows SUPER_ADMIN to invalidate the in-memory cache of role permissions
 * Use this after updating permissions in Wix to force reload
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { invalidatePermissionsCache } from '@/config/roles';
import { Role } from '@/types/permissions';

export async function POST(request: Request) {
  // Verificar autenticación
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  const userRole = (session.user as any)?.role;

  // Solo SUPER_ADMIN y ADMIN pueden invalidar cache
  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'admin') {
    return NextResponse.json(
      { error: 'No autorizado. Solo SUPER_ADMIN puede invalidar cache.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { role } = body;

    if (role) {
      // Invalidar cache de un rol específico
      invalidatePermissionsCache(role as Role);
      console.log(`✅ Cache invalidado para rol: ${role} por usuario ${session.user.email}`);

      return NextResponse.json({
        success: true,
        message: `Cache invalidado para ${role}. Los nuevos permisos se cargarán en el próximo request.`
      });
    } else {
      // Invalidar cache completo
      invalidatePermissionsCache();
      console.log(`✅ Cache completo invalidado por usuario ${session.user.email}`);

      return NextResponse.json({
        success: true,
        message: 'Cache completo invalidado. Los nuevos permisos se cargarán en el próximo request.'
      });
    }

  } catch (error) {
    console.error('❌ Error al invalidar cache:', error);
    return NextResponse.json(
      { error: 'Error al invalidar cache' },
      { status: 500 }
    );
  }
}
