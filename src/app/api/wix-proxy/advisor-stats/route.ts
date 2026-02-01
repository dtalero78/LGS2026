import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { advisorId, fechaInicio, fechaFin } = body

    console.log('📊 [PostgreSQL] Getting advisor stats:', { advisorId, fechaInicio, fechaFin })

    // Build the query with optional date filters
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

    const eventsResult = await query(sql, params)
    const events = eventsResult.rows

    // Calculate stats
    const totalSesiones = events.length
    const totalInscritos = events.reduce((sum: number, e: any) => sum + (parseInt(e.inscritosCount) || 0), 0)
    const totalAsistieron = events.reduce((sum: number, e: any) => sum + (parseInt(e.asistieronCount) || 0), 0)
    const tasaAsistencia = totalInscritos > 0 ? Math.round((totalAsistieron / totalInscritos) * 100) : 0

    // Count by type
    const sesionesPorTipo: Record<string, number> = {}
    events.forEach((e: any) => {
      const tipo = e.tipo || 'OTROS'
      sesionesPorTipo[tipo] = (sesionesPorTipo[tipo] || 0) + 1
    })

    console.log('✅ [PostgreSQL] Advisor stats calculated:', {
      totalSesiones,
      totalInscritos,
      totalAsistieron,
      tasaAsistencia
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalSesiones,
        totalInscritos,
        totalAsistieron,
        tasaAsistencia,
        sesionesPorTipo
      },
      events: events
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in advisor-stats:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch advisor stats' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
