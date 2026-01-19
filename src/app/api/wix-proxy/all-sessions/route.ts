import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

// Aumentar timeout para permitir cargar todos los datos
export const maxDuration = 60 // 60 segundos

export async function POST(request: NextRequest) {
  try {
    console.log('📚 Cargando TODAS las sesiones de CLASSES...')

    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    // Llamar al endpoint getAllClassSessions de Wix
    const response = await fetch(
      `${WIX_API_BASE_URL}/getAllClassSessions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fechaInicio,
          fechaFin
        })
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Wix API response:', errorText)
      return NextResponse.json(
        { success: false, error: `Wix API error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Datos de sesiones recibidos de Wix:', data.total || 0, 'sesiones')

    return NextResponse.json({
      success: true,
      sessions: data.sessions || data.items || [],
      total: data.total || data.totalCount || 0
    })

  } catch (error) {
    console.error('❌ Error en all-sessions API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
