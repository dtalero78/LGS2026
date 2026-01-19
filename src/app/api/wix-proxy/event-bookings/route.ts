import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

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

    console.log('📊 Fetching event bookings for:', finalEventId)

    const response = await fetch(
      `${WIX_API_BASE_URL}/getEventBookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: finalEventId
        })
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status, response.statusText)
      return NextResponse.json(
        { success: false, error: `Wix API error: ${response.status}`, count: 0 },
        { status: response.status }
      )
    }

    const data = await response.json()
    const rawBookings = data?.bookings || []
    const classes = data?.classes || []

    // Map bookings to include class data if exists
    const bookings = rawBookings.map((booking: any) => {
      const classData = classes.find((c: any) => c.idEstudiante === booking.idEstudiante)
      return {
        ...booking,
        classData: classData || null
      }
    })

    const count = bookings.length
    const asistieron = bookings.filter((b: any) => b.classData?.asistencia === true).length

    // Log hobbies de cada estudiante
    console.log('🔍 DEBUG - Hobbies de estudiantes en bookings:')
    bookings.forEach((b: any) => {
      console.log(`  - ${b.primerNombre} ${b.primerApellido}: hobbies = "${b.hobbies}"`)
    })

    console.log('✅ Event bookings received:', count, '| Classes:', classes.length, '| Asistieron:', asistieron)

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