import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

/**
 * GET /api/wix-proxy/all-roles
 * Get all roles from PostgreSQL ROL_PERMISOS table
 */
export async function GET() {
  try {
    console.log('🔄 [PostgreSQL] Fetching all roles')

    const result = await query(
      `SELECT * FROM "ROL_PERMISOS" ORDER BY "rol" ASC`
    )

    console.log(`✅ [PostgreSQL] Found ${result.rowCount} roles`)

    return NextResponse.json({
      success: true,
      roles: result.rows
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error fetching all roles:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener roles',
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  )
}
