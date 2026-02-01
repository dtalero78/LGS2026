/**
 * API Route: Get/Update role permissions from PostgreSQL
 * Queries ROL_PERMISOS table to get/update permissions for a specific role
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rol = searchParams.get('rol')

  if (!rol) {
    return NextResponse.json(
      { success: false, error: 'Parámetro rol es requerido', permisos: [] },
      { status: 400 }
    )
  }

  try {
    console.log(`🔍 [PostgreSQL] Consultando permisos para rol: ${rol}`)

    const result = await query(
      `SELECT * FROM "ROL_PERMISOS" WHERE "rol" = $1`,
      [rol]
    )

    if (result.rowCount === 0) {
      console.log(`⚠️ [PostgreSQL] Rol no encontrado: ${rol}`)
      return NextResponse.json(
        { success: false, error: 'Rol no encontrado', permisos: [] },
        { status: 404 }
      )
    }

    const roleData = result.rows[0]
    const permisos = roleData.permisos || []

    console.log(`✅ [PostgreSQL] Permisos encontrados para ${rol}: ${permisos.length} permisos`)

    return NextResponse.json({
      success: true,
      rol: roleData.rol,
      permisos: permisos,
      descripcion: roleData.descripcion
    })

  } catch (error: any) {
    console.error(`❌ [PostgreSQL] Error al consultar permisos del rol:`, error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor', permisos: [] },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rol, permisos } = body

    if (!rol || !permisos) {
      return NextResponse.json(
        { success: false, error: 'Parámetros rol y permisos son requeridos' },
        { status: 400 }
      )
    }

    console.log(`🔄 [PostgreSQL] Actualizando permisos para rol: ${rol}, total: ${permisos.length} permisos`)

    const result = await query(
      `UPDATE "ROL_PERMISOS"
       SET "permisos" = $1,
           "_updatedDate" = NOW()
       WHERE "rol" = $2
       RETURNING *`,
      [JSON.stringify(permisos), rol]
    )

    if (result.rowCount === 0) {
      console.log(`⚠️ [PostgreSQL] Rol no encontrado para actualizar: ${rol}`)
      return NextResponse.json(
        { success: false, error: 'Rol no encontrado' },
        { status: 404 }
      )
    }

    console.log(`✅ [PostgreSQL] Permisos actualizados exitosamente para ${rol}`)

    return NextResponse.json({
      success: true,
      rol: result.rows[0].rol,
      permisos: result.rows[0].permisos
    })

  } catch (error: any) {
    console.error(`❌ [PostgreSQL] Error al actualizar permisos:`, error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
