import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { advisorId, fechaInicio, fechaFin } = body

    console.log('📅 [PostgreSQL] Calendario Events By Advisor:', { advisorId, fechaInicio, fechaFin })

    if (!advisorId) {
      return NextResponse.json(
        { success: false, error: 'advisorId is required' },
        { status: 400 }
      )
    }

    // Build query with optional date filters
    let sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id") as "inscritosCount",
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id" AND ab."asistio" = true) as "asistieronCount"
      FROM "CALENDARIO" c
      WHERE c."advisor" = $1
    `
    const params: any[] = [advisorId]
    let paramIndex = 2

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

    console.log('📅 [PostgreSQL] Success, eventos count:', result.rowCount)

    return NextResponse.json({
      success: true,
      events: result.rows,
      eventos: result.rows,
      total: result.rowCount || 0
    })

  } catch (error: any) {
    console.error('📅 [PostgreSQL] Calendario Events By Advisor error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
