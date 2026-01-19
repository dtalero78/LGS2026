import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function PUT(request: NextRequest) {
  try {
    const eventData = await request.json()

    console.log('📝 Updating calendar event in CALENDARIO:', eventData)

    // Actualizar evento en CALENDARIO
    const calendarioResponse = await fetch(
      `${WIX_API_BASE_URL}/updateCalendarioEvent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      }
    )

    if (!calendarioResponse.ok) {
      console.error('❌ Wix API error updating calendario event:', calendarioResponse.status)
      return NextResponse.json(
        { success: false, error: `Error updating calendario event: ${calendarioResponse.status}` },
        { status: calendarioResponse.status }
      )
    }

    const calendarioData = await calendarioResponse.json()
    console.log('✅ Calendario event updated:', calendarioData)

    return NextResponse.json({
      success: true,
      event: calendarioData.event,
      message: 'Evento actualizado exitosamente en CALENDARIO'
    })

  } catch (error) {
    console.error('❌ Error in update-calendario-event API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}