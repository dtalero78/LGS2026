/**
 * API Route: /api/user/permissions
 * Devuelve los permisos del usuario actual desde Wix
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role } from '@/types/permissions';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

/**
 * GET /api/user/permissions
 * Obtiene los permisos del usuario actual desde Wix
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role as Role;

    if (!userRole) {
      return NextResponse.json(
        { error: 'Usuario sin rol asignado' },
        { status: 400 }
      );
    }

    console.log(`🔐 Cargando permisos para rol: ${userRole}`);

    // Cargar permisos desde Wix
    try {
      const wixResponse = await fetch(
        `${WIX_API_BASE_URL}/rolePermissions?rol=${encodeURIComponent(userRole)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          cache: 'no-store',
        }
      );

      if (!wixResponse.ok) {
        throw new Error(`Wix API error: ${wixResponse.status}`);
      }

      const wixData = await wixResponse.json();

      if (wixData.success && wixData.permisos) {
        console.log(`✅ Permisos cargados desde Wix para ${userRole}:`, wixData.permisos.length);

        return NextResponse.json(
          {
            success: true,
            source: 'wix',
            role: userRole,
            permissions: wixData.permisos,
            count: wixData.permisos.length,
          },
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          }
        );
      } else {
        throw new Error('Wix response invalid');
      }
    } catch (wixError) {
      console.error('⚠️ Error al cargar permisos desde Wix:', wixError);

      // FALLBACK: Usar permisos hardcodeados
      const { getPermissionsByRole } = await import('@/config/roles');
      const fallbackPermissions = getPermissionsByRole(userRole);

      console.log(`⚠️ Usando permisos fallback para ${userRole}:`, fallbackPermissions.length);

      return NextResponse.json(
        {
          success: true,
          source: 'fallback',
          role: userRole,
          permissions: fallbackPermissions,
          count: fallbackPermissions.length,
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
  } catch (error) {
    console.error('❌ Error en GET /api/user/permissions:', error);
    return NextResponse.json(
      { error: 'Error al obtener permisos' },
      { status: 500 }
    );
  }
}
