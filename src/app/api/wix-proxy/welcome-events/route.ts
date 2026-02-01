import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

// Aumentar timeout para permitir cargar todos los datos
export const maxDuration = 60 // 60 segundos

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    const hasDateFilter = fechaInicio || fechaFin
    const logMessage = hasDateFilter
      ? `📅 [PostgreSQL] Cargando eventos WELCOME desde ${fechaInicio || 'inicio'} hasta ${fechaFin || 'fin'}...`
      : '📅 [PostgreSQL] Cargando TODOS los eventos WELCOME (pasados, presentes y futuros)...'

    console.log(logMessage)

    // Build query with optional date filters
    let sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id") as "inscritosCount",
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id" AND ab."asistio" = true) as "asistieronCount"
      FROM "CALENDARIO" c
      WHERE (c."tipo" = 'WELCOME' OR c."tipo" = 'WELCOME_EVENT' OR LOWER(c."tituloONivel") LIKE '%welcome%')
    `

    const params: any[] = []
    let paramIndex = 1

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

    console.log('✅ [PostgreSQL] Datos de eventos WELCOME recibidos:', result.rowCount)

    return NextResponse.json({
      success: true,
      events: result.rows,
      total: result.rowCount
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error en welcome-events API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
