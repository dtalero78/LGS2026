import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

/**
 * GET /api/wix-proxy/material-usuario?step=Step 1
 * Obtiene el campo materialUsuario de un step específico desde la colección NIVELES
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const step = searchParams.get('step') || 'Step 1'

    console.log('📚 Obteniendo materialUsuario para step:', step)

    // Llamar al endpoint de Wix para obtener el material de usuario
    const response = await fetch(
      `${WIX_API_BASE_URL}/getMaterialUsuario?step=${encodeURIComponent(step)}`,
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
    console.log('✅ Material usuario obtenido:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in material-usuario API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
