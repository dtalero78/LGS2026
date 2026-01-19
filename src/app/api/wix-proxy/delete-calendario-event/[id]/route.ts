import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id

    console.log('🗑️ Deleting calendar event:', eventId)

    // Eliminar evento de CALENDARIO
    const response = await fetch(
      `${WIX_API_BASE_URL}/deleteCalendarioEvent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId
        })
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error deleting event:', response.status)
      return NextResponse.json(
        { success: false, error: `Error deleting event: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Calendario event deleted:', eventId)

    return NextResponse.json({
      success: true,
      message: 'Evento eliminado exitosamente de CALENDARIO'
    })

  } catch (error) {
    console.error('❌ Error in delete-calendario-event API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}