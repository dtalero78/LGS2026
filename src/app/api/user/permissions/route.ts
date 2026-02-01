/**
 * API Route: /api/user/permissions
 * Devuelve los permisos del usuario actual desde PostgreSQL
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@/types/permissions'
import { query } from '@/lib/postgres'

/**
 * GET /api/user/permissions
 * Obtiene los permisos del usuario actual desde PostgreSQL
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const userRole = (session.user as any).role as Role

    if (!userRole) {
      return NextResponse.json(
        { error: 'Usuario sin rol asignado' },
        { status: 400 }
      )
    }

    console.log(`🔐 [PostgreSQL] Cargando permisos para rol: ${userRole}`)

    try {
      const result = await query(
        `SELECT "permisos", "descripcion" FROM "ROL_PERMISOS" WHERE "rol" = $1`,
        [userRole]
      )

      if (result.rowCount === 0) {
        console.warn(`⚠️ [PostgreSQL] Rol ${userRole} no encontrado`)
        return NextResponse.json(
          {
            success: true,
            source: 'postgres',
            role: userRole,
            permissions: [],
            count: 0,
          },
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          }
        )
      }

      const roleData = result.rows[0]
      const permissions = roleData.permisos || []

      console.log(`✅ [PostgreSQL] Permisos cargados para ${userRole}:`, permissions.length)

      return NextResponse.json(
        {
          success: true,
          source: 'postgres',
          role: userRole,
          permissions: permissions,
          count: permissions.length,
        },
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      )
    } catch (dbError) {
      console.error('❌ [PostgreSQL] Error al cargar permisos:', dbError)

      // FALLBACK: Usar permisos hardcodeados solo si PostgreSQL falla
      const { getPermissionsByRole } = await import('@/config/roles')
      const fallbackPermissions = getPermissionsByRole(userRole)

      console.log(`⚠️ Usando permisos fallback para ${userRole}:`, fallbackPermissions.length)

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
      )
    }
  } catch (error) {
    console.error('❌ Error en GET /api/user/permissions:', error)
    return NextResponse.json(
      { error: 'Error al obtener permisos' },
      { status: 500 }
    )
  }
}
