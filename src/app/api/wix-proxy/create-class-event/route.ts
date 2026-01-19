import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const eventData = await request.json()
    console.log('📚 Creating new class event:', eventData)
    console.log('👤 Agendado por:', eventData.agendadoPor, '| Rol:', eventData.agendadoPorRol)

    // Create class event
    const classResponse = await fetch(
      `${WIX_API_BASE_URL}/createClassEvent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      }
    )

    if (!classResponse.ok) {
      console.error('❌ Wix API error creating class:', classResponse.status, classResponse.statusText)
      return NextResponse.json(
        { success: false, error: `Wix API error: ${classResponse.status}` },
        { status: classResponse.status }
      )
    }

    const classData = await classResponse.json()
    console.log('✅ Class event created:', classData)

    // Also create booking event
    try {
      const bookingResponse = await fetch(
        `${WIX_API_BASE_URL}/createBookingEvent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData)
        }
      )

      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json()
        console.log('✅ Booking event created:', bookingData)
      } else {
        console.warn('⚠️ Warning: Booking event creation failed, but class event succeeded')
      }
    } catch (bookingError) {
      console.warn('⚠️ Warning: Booking event creation failed:', bookingError)
    }

    return NextResponse.json(classData)

  } catch (error) {
    console.error('❌ Error in create-class-event API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}