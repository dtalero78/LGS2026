import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId } = body

    console.log('🔢 Proxy: Solicitud de conteo de inscritos para evento:', eventId)

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'ID de evento requerido' },
        { status: 400 }
      )
    }

    const response = await fetch(`${WIX_API_BASE_URL}/getEventInscritosCount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventId })
    })

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status)
      return NextResponse.json(
        { success: false, error: `Error del servidor Wix: ${response.status}`, inscritos: 0 },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Conteo de inscritos recibido:', data)

    // Asegurar que incluye tanto inscritos como asistencias
    const responseData = {
      success: data.success,
      inscritos: data.inscritos || 0,
      asistieron: data.asistieron || 0
    }

    return NextResponse.json(responseData, { status: 200 })

  } catch (error) {
    console.error('❌ Error en evento-inscritos proxy:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', inscritos: 0 },
      { status: 500 }
    )
  }
}