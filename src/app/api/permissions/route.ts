/**
 * API Route: /api/permissions
 * Gestión de permisos y roles del sistema
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@/types/permissions'
import { ROLE_PERMISSIONS_MATRIX, getPermissionsByRole } from '@/config/roles'
import { PERMISSIONS_CATALOG } from '@/config/permissions'
import { getPermissionsForRole } from '@/lib/custom-permissions'
import { query } from '@/lib/postgres'

/**
 * GET /api/permissions
 * Obtiene la matriz completa de permisos desde PostgreSQL
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const userRole = (session.user as any).role as Role

    // Solo SUPER_ADMIN, ADMIN, o 'admin' (legacy) pueden ver la matriz completa
    const allowedRoles = [Role.SUPER_ADMIN, Role.ADMIN, 'admin' as Role]
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes' },
        { status: 403 }
      )
    }

    console.log('📊 [PostgreSQL] Cargando permisos...')

    try {
      const result = await query(
        `SELECT "rol", "permisos", "descripcion", "activo"
         FROM "ROL_PERMISOS"
         ORDER BY "rol" ASC`
      )

      if (result.rowCount === 0) {
        throw new Error('No roles found in database')
      }

      console.log(`✅ [PostgreSQL] Cargados ${result.rowCount} roles`)

      // Log TALERO specifically
      const taleroRole = result.rows.find((r: any) => r.rol === 'TALERO')
      console.log('🔍 DEBUG: TALERO permisos desde PostgreSQL:', taleroRole?.permisos)

      // Construir matriz con roles de PostgreSQL
      const matrix = result.rows.map((row: any) => ({
        role: row.rol,
        permissions: row.permisos || [],
        count: (row.permisos || []).length,
        descripcion: row.descripcion,
        activo: row.activo,
      }))

      // Obtener lista única de roles
      const roles = result.rows.map((r: any) => r.rol)

      return NextResponse.json(
        {
          success: true,
          source: 'postgres',
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
      )
    } catch (dbError) {
      console.error('⚠️ [PostgreSQL] Error al cargar permisos, usando fallback:', dbError)

      // FALLBACK: Usar permisos hardcodeados si PostgreSQL falla
      console.log('⚠️ Usando permisos hardcodeados como fallback')
      const matrix = ROLE_PERMISSIONS_MATRIX.map((rolePerms) => {
        const permissions = getPermissionsForRole(rolePerms.role)
        return {
          role: rolePerms.role,
          permissions,
          count: permissions.length,
        }
      })

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
      )
    }
  } catch (error) {
    console.error('Error en GET /api/permissions:', error)
    return NextResponse.json(
      { error: 'Error al obtener permisos' },
      { status: 500 }
    )
  }
}
