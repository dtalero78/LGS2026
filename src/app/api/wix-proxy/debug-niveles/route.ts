import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

/**
 * GET /api/wix-proxy/debug-niveles?nivel=BN1
 * Inspecciona el orden de los steps en la base de datos NIVELES
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = searchParams.get('nivel') || 'BN1'

    console.log('🔍 Diagnosticando orden de steps para nivel:', nivel)

    // Llamar al endpoint de Wix para ejecutar debugNivelesOrder
    const response = await fetch(
      `${WIX_API_BASE_URL}/debugNivelesOrder?nivel=${encodeURIComponent(nivel)}`,
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
    console.log('✅ Diagnóstico obtenido:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in debug-niveles API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
