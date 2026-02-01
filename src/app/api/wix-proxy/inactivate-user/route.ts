import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: Request) {
  try {
    const { beneficiarioId } = await request.json()

    if (!beneficiarioId) {
      return NextResponse.json(
        { success: false, error: 'beneficiarioId es requerido' },
        { status: 400 }
      )
    }

    console.log('🔄 [PostgreSQL] Inactivating user:', beneficiarioId)

    // Update the user's estado to Inactivo
    const result = await query(
      `UPDATE "PEOPLE"
       SET "estado" = 'Inactivo',
           "estadoInactivo" = true,
           "_updatedDate" = NOW()
       WHERE "_id" = $1
       RETURNING *`,
      [beneficiarioId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Also update ACADEMICA record if exists
    await query(
      `UPDATE "ACADEMICA"
       SET "estadoInactivo" = true,
           "_updatedDate" = NOW()
       WHERE "visitorId" = $1`,
      [beneficiarioId]
    )

    console.log('✅ [PostgreSQL] User inactivated:', beneficiarioId)

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error al inactivar usuario:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
