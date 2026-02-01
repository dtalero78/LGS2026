import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

// Aumentar timeout para permitir cargar todos los datos
export const maxDuration = 60 // 60 segundos

export async function POST(request: NextRequest) {
  try {
    console.log('📚 [PostgreSQL] Cargando TODAS las sesiones de CLASSES...')

    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    // Build query with optional date filters
    let sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id") as "inscritosCount",
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id" AND ab."asistio" = true) as "asistieronCount"
      FROM "CALENDARIO" c
      WHERE c."tipo" = 'SESSION' OR c."tipo" = 'CLASS'
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

    console.log('✅ [PostgreSQL] Datos de sesiones recibidos:', result.rowCount, 'sesiones')

    return NextResponse.json({
      success: true,
      sessions: result.rows,
      total: result.rowCount || 0
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error en all-sessions API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
