import { NextRequest, NextResponse } from 'next/server'

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

    // Use PostgreSQL endpoint
    const baseUrl = process.env.NODE_ENV === 'production'
      ? (process.env.NEXTAUTH_URL || '')
      : 'http://localhost:3001'

    const response = await fetch(
      `${baseUrl}/api/postgres/calendar/${encodeURIComponent(finalEventId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      console.error('❌ PostgreSQL API error:', response.status, response.statusText)
      return NextResponse.json(
        { success: false, error: `PostgreSQL API error: ${response.status}`, count: 0 },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bookings', count: 0 },
        { status: 500 }
      )
    }

    // PostgreSQL response already includes student data via LEFT JOIN
    const bookings = (data.data || []).map((booking: any) => ({
      ...booking,
      // Map asistencia boolean to classData for backward compatibility
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
    const asistieron = bookings.filter((b: any) => b.classData?.asistencia === true).length

    console.log('✅ Event bookings received from PostgreSQL:', count, '| Asistieron:', asistieron)

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
    console.error('❌ Error in event-bookings API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', count: 0 },
      { status: 500 }
    )
  }
}