import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = searchParams.get('nivel')
    const tipoEvento = searchParams.get('tipoEvento')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')

    console.log('🗓️ [PostgreSQL] Fetching calendar events:', { nivel, tipoEvento, fechaInicio, fechaFin })

    // Build query with optional filters
    let sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id") as "inscritosCount",
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id" AND ab."asistio" = true) as "asistieronCount"
      FROM "CALENDARIO" c
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (nivel) {
      sql += ` AND c."nivel" = $${paramIndex}`
      params.push(nivel)
      paramIndex++
    }

    if (tipoEvento) {
      sql += ` AND c."tipo" = $${paramIndex}`
      params.push(tipoEvento)
      paramIndex++
    }

    if (fechaInicio) {
      sql += ` AND c."dia" >= $${paramIndex}::timestamp with time zone`
      params.push(fechaInicio)
      paramIndex++
    }

    if (fechaFin) {
      sql += ` AND c."dia" <= $${paramIndex}::timestamp with time zone`
      params.push(fechaFin)
      paramIndex++
    }

    sql += ` ORDER BY c."dia" DESC`

    const result = await query(sql, params)

    console.log('✅ [PostgreSQL] Calendar events received:', result.rowCount)

    return NextResponse.json({
      success: true,
      events: result.rows,
      total: result.rowCount || 0
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in calendario-eventos API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
