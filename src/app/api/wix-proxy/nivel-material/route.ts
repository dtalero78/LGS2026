import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

/**
 * GET /api/postgres/materials/nivel?step=Step1
 * Obtiene los materiales de un step específico desde la colección NIVELES
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const step = searchParams.get('step')

    if (!step) {
      return NextResponse.json(
        { success: false, error: 'Step parameter is required' },
        { status: 400 }
      )
    }

    console.log('📚 Obteniendo material para step:', step)

    // Llamar al endpoint de Wix para obtener el material
    const response = await fetch(
      `${WIX_API_BASE_URL}/getNivelMaterial?step=${encodeURIComponent(step)}`,
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
    console.log('✅ Material obtenido:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in nivel-material API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
