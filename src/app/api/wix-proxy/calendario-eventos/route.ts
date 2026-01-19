import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = searchParams.get('nivel')
    const tipoEvento = searchParams.get('tipoEvento')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')

    console.log('🗓️ Fetching calendar events:', { nivel, tipoEvento, fechaInicio, fechaFin })

    // Build query string
    const params = new URLSearchParams()
    if (nivel) params.append('nivel', nivel)
    if (tipoEvento) params.append('tipoEvento', tipoEvento)
    if (fechaInicio) params.append('fechaInicio', fechaInicio)
    if (fechaFin) params.append('fechaFin', fechaFin)

    const response = await fetch(
      `${WIX_API_BASE_URL}/calendarioEventos?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status, response.statusText)
      return NextResponse.json(
        { success: false, error: `Wix API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Calendar events received:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in calendario-eventos API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}