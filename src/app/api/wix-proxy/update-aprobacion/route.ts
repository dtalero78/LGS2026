import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: Request) {
  try {
    const { personId, aprobacion } = await request.json()

    if (!personId || !aprobacion) {
      return NextResponse.json(
        { success: false, error: 'personId y aprobacion son requeridos' },
        { status: 400 }
      )
    }

    console.log('📝 [PostgreSQL] Updating aprobacion:', { personId, aprobacion })

    // Update the person's estado field
    const result = await query(
      `UPDATE "PEOPLE"
       SET "estado" = $1,
           "_updatedDate" = NOW()
       WHERE "_id" = $2
       RETURNING *`,
      [aprobacion, personId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Persona no encontrada' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Aprobación actualizada:', personId)

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error al actualizar aprobación:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
