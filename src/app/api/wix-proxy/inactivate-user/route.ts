import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { beneficiarioId } = await request.json()

    if (!beneficiarioId) {
      return NextResponse.json(
        { success: false, error: 'beneficiarioId es requerido' },
        { status: 400 }
      )
    }

    const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL

    if (!WIX_API_BASE_URL) {
      console.error('WIX_API_BASE_URL no configurada')
      return NextResponse.json(
        { success: false, error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    // Llamar a la función de Wix para inactivar el usuario
    const wixUrl = `${WIX_API_BASE_URL}/inactivateUser`

    console.log('🔄 Proxy: Calling inactivateUser for userId:', beneficiarioId)

    const wixResponse = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: beneficiarioId
      })
    })

    if (!wixResponse.ok) {
      const errorText = await wixResponse.text()
      console.error('Error de Wix:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error al inactivar usuario en Wix' },
        { status: wixResponse.status }
      )
    }

    const wixData = await wixResponse.json()
    return NextResponse.json({
      success: true,
      data: wixData
    })

  } catch (error) {
    console.error('Error al inactivar usuario:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
