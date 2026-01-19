import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const eventData = await request.json()

    console.log('➕ Creating calendar event in CALENDARIO:', eventData)

    // Crear evento en CALENDARIO (tabla de eventos del calendario)
    const calendarioResponse = await fetch(
      `${WIX_API_BASE_URL}/createCalendarioEvent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      }
    )

    if (!calendarioResponse.ok) {
      console.error('❌ Wix API error creating calendario event:', calendarioResponse.status)
      return NextResponse.json(
        { success: false, error: `Error creating calendario event: ${calendarioResponse.status}` },
        { status: calendarioResponse.status }
      )
    }

    const calendarioData = await calendarioResponse.json()
    console.log('✅ Calendario event created:', calendarioData)

    return NextResponse.json({
      success: true,
      event: calendarioData.event,
      message: 'Evento creado exitosamente en CALENDARIO'
    })

  } catch (error) {
    console.error('❌ Error in create-calendario-event API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}