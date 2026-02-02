import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fechaInicio, fechaFin, advisorId } = body

    console.log('🗓️ [PostgreSQL] Fetching calendar events:', { fechaInicio, fechaFin, advisorId })

    let sql = `
      SELECT
        c.*,
        a."primerNombre" as "advisorPrimerNombre",
        a."primerApellido" as "advisorPrimerApellido",
        a."nombreCompleto" as "advisorNombreCompleto",
        a."email" as "advisorEmail"
      FROM "CALENDARIO" c
      LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
      WHERE c."dia" >= $1 AND c."dia" <= $2
    `
    const params: any[] = [fechaInicio, fechaFin]

    if (advisorId) {
      sql += ` AND c."advisor" = $3`
      params.push(advisorId)
    }

    sql += ` ORDER BY c."dia", c."hora"`

    const result = await query(sql, params)

    console.log('✅ [PostgreSQL] Calendar events received:', result.rows.length)

    return NextResponse.json({
      success: true,
      events: result.rows
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in calendario-events API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
