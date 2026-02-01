import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventIds } = body

    console.log('🔢📊 [PostgreSQL] Conteo de inscritos para múltiples eventos:', eventIds?.length || 0)

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Array de IDs de eventos requerido' },
        { status: 400 }
      )
    }

    // Query to count inscritos and asistencias per event
    const result = await query(
      `SELECT
        "eventoId",
        COUNT(*) as "inscritosCount",
        COUNT(*) FILTER (WHERE "asistio" = true) as "asistenciasCount"
      FROM "ACADEMICA_BOOKINGS"
      WHERE "eventoId" = ANY($1)
      GROUP BY "eventoId"`,
      [eventIds]
    )

    // Build the response maps
    const inscritosCounts: Record<string, number> = {}
    const asistenciasCounts: Record<string, number> = {}
    let totalBookings = 0

    result.rows.forEach((row: any) => {
      inscritosCounts[row.eventoId] = parseInt(row.inscritosCount) || 0
      asistenciasCounts[row.eventoId] = parseInt(row.asistenciasCount) || 0
      totalBookings += parseInt(row.inscritosCount) || 0
    })

    // Initialize events with no bookings to 0
    eventIds.forEach((eventId: string) => {
      if (!(eventId in inscritosCounts)) {
        inscritosCounts[eventId] = 0
        asistenciasCounts[eventId] = 0
      }
    })

    const mappedData = {
      success: true,
      inscritosCounts,
      asistenciasCounts,
      totalEventos: eventIds.length,
      totalBookings
    }

    console.log('✅ [PostgreSQL] Conteo de inscritos:', Object.keys(inscritosCounts).length, 'eventos')

    return NextResponse.json(mappedData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error en eventos-inscritos-batch:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', inscritosCounts: {} },
      { status: 500 }
    )
  }
}
