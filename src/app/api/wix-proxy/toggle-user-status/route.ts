import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: Request) {
  try {
    const { userId, setInactive } = await request.json()

    if (!userId || setInactive === undefined) {
      return NextResponse.json(
        { success: false, error: 'userId y setInactive son requeridos' },
        { status: 400 }
      )
    }

    console.log('🔄 [PostgreSQL] Toggle user status', { userId, setInactive })

    const newEstado = setInactive ? 'Inactivo' : 'Aprobado'

    // Update PEOPLE table
    const result = await query(
      `UPDATE "PEOPLE"
       SET "estado" = $1,
           "estadoInactivo" = $2,
           "_updatedDate" = NOW()
       WHERE "_id" = $3
       RETURNING *`,
      [newEstado, setInactive, userId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Also update ACADEMICA if exists
    await query(
      `UPDATE "ACADEMICA"
       SET "estadoInactivo" = $1,
           "_updatedDate" = NOW()
       WHERE "visitorId" = $2`,
      [setInactive, userId]
    )

    console.log('✅ [PostgreSQL] User status updated:', {
      userId,
      newEstado,
      estadoInactivo: setInactive
    })

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error al cambiar estado:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
