import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 DEBUG: Comparing counts for event:', eventId)

    // Llamar a getEventBookings (usado por el modal)
    const bookingsResponse = await fetch(`${WIX_API_BASE_URL}/getEventBookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    })

    // Llamar a getMultipleEventsInscritosCount (usado por la vista general)
    const countsResponse = await fetch(`${WIX_API_BASE_URL}/getMultipleEventsInscritosCount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds: [eventId] })
    })

    const bookingsData = bookingsResponse.ok ? await bookingsResponse.json() : null
    const countsData = countsResponse.ok ? await countsResponse.json() : null

    const modalCount = bookingsData?.bookings?.length || 0
    const generalCount = countsData?.inscritosPorEvento?.[eventId] || 0

    console.log('🔍 DEBUG Results:')
    console.log('  Modal count (getEventBookings):', modalCount)
    console.log('  General count (getMultipleEventsInscritosCount):', generalCount)
    console.log('  Bookings data:', bookingsData?.bookings?.slice(0, 3))
    console.log('  Counts data:', countsData?.inscritosPorEvento)

    return NextResponse.json({
      success: true,
      eventId,
      modalCount,
      generalCount,
      difference: modalCount - generalCount,
      bookingsPreview: bookingsData?.bookings?.slice(0, 3) || [],
      rawBookingsData: bookingsData,
      rawCountsData: countsData
    })

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}