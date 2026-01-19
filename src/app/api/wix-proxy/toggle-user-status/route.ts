import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, setInactive } = await request.json()

    if (!userId || setInactive === undefined) {
      return NextResponse.json(
        { success: false, error: 'userId y setInactive son requeridos' },
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

    const wixUrl = `${WIX_API_BASE_URL}/toggleUserStatus`

    console.log('🔄 Proxy: Toggle user status', { userId, setInactive })

    const wixResponse = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        setInactive
      })
    })

    if (!wixResponse.ok) {
      const errorText = await wixResponse.text()
      console.error('Error de Wix:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error al cambiar estado en Wix' },
        { status: wixResponse.status }
      )
    }

    const wixData = await wixResponse.json()
    return NextResponse.json({
      success: true,
      data: wixData
    })

  } catch (error) {
    console.error('Error al cambiar estado:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
