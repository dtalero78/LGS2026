import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId } = body

    console.log('🔢 [PostgreSQL] Solicitud de conteo de inscritos para evento:', eventId)

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'ID de evento requerido' },
        { status: 400 }
      )
    }

    // Count total enrolled and attended
    const result = await query(`
      SELECT
        COUNT(*) as inscritos,
        COUNT(CASE WHEN "asistio" = true THEN 1 END) as asistieron
      FROM "ACADEMICA_BOOKINGS"
      WHERE "eventoId" = $1
    `, [eventId])

    const data = result.rows[0]

    console.log('✅ [PostgreSQL] Conteo de inscritos:', data)

    return NextResponse.json({
      success: true,
      inscritos: parseInt(data.inscritos) || 0,
      asistieron: parseInt(data.asistieron) || 0
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error en evento-inscritos:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor', inscritos: 0 },
      { status: 500 }
    )
  }
}
