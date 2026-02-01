import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { idEvento, eventId } = body
    const finalEventId = idEvento || eventId

    if (!finalEventId) {
      console.error('❌ No event ID provided')
      return NextResponse.json(
        { success: false, error: 'Event ID is required', count: 0, bookings: [] },
        { status: 400 }
      )
    }

    console.log('📊 [PostgreSQL] Fetching event bookings for:', finalEventId)

    // Query bookings with student data joined
    const result = await query(
      `SELECT
        ab.*,
        p."primerNombre",
        p."segundoNombre",
        p."primerApellido",
        p."segundoApellido",
        p."numeroId",
        p."email",
        p."celular",
        p."nivel" as "studentNivel",
        p."step" as "studentStep",
        p."plataforma"
      FROM "ACADEMICA_BOOKINGS" ab
      LEFT JOIN "PEOPLE" p ON ab."visitorId" = p."_id"
      WHERE ab."eventoId" = $1
      ORDER BY p."primerApellido" ASC, p."primerNombre" ASC`,
      [finalEventId]
    )

    // Map bookings with classData for backward compatibility
    const bookings = result.rows.map((booking: any) => ({
      ...booking,
      classData: {
        asistencia: booking.asistencia || false,
        asistio: booking.asistio || false,
        participacion: booking.participacion || null,
        noAprobo: booking.noAprobo || false,
        cancelo: booking.cancelo || false,
        calificacion: booking.calificacion || null
      }
    }))

    const count = bookings.length
    const asistieron = bookings.filter((b: any) => b.asistio === true).length

    console.log('✅ [PostgreSQL] Event bookings received:', count, '| Asistieron:', asistieron)

    return NextResponse.json({
      success: true,
      count,
      asistieron,
      bookings
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error in event-bookings API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', count: 0 },
      { status: 500 }
    )
  }
}
