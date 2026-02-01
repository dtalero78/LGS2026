import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

/**
 * POST /api/wix-proxy/create-role
 * Create a new role in PostgreSQL ROL_PERMISOS table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rol, descripcion, permisos, activo } = body

    if (!rol) {
      return NextResponse.json(
        { success: false, error: 'El nombre del rol es requerido' },
        { status: 400 }
      )
    }

    console.log('🔄 [PostgreSQL] Creating role:', rol)

    // Check if role already exists
    const existingRole = await query(
      `SELECT "_id" FROM "ROL_PERMISOS" WHERE "rol" = $1`,
      [rol]
    )

    if (existingRole.rowCount && existingRole.rowCount > 0) {
      return NextResponse.json(
        { success: false, error: 'El rol ya existe' },
        { status: 400 }
      )
    }

    // Generate unique ID
    const roleId = `rol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const result = await query(
      `INSERT INTO "ROL_PERMISOS" (
        "_id", "rol", "descripcion", "permisos", "activo",
        "origen", "_createdDate", "_updatedDate"
      ) VALUES ($1, $2, $3, $4, $5, 'POSTGRES', NOW(), NOW())
      RETURNING *`,
      [
        roleId,
        rol,
        descripcion || null,
        JSON.stringify(permisos || []),
        activo !== false
      ]
    )

    console.log(`✅ [PostgreSQL] Role created: ${rol}`)

    return NextResponse.json({
      success: true,
      role: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error creating role:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear rol',
        details: error.message || 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  )
}
