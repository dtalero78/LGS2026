import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { personId, aprobacion } = await request.json()

    if (!personId || !aprobacion) {
      return NextResponse.json(
        { success: false, error: 'personId y aprobacion son requeridos' },
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

    // Llamar a la función de Wix para actualizar el estado de aprobación
    const wixUrl = `${WIX_API_BASE_URL}/updateAprobacion`

    const wixResponse = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personId,
        aprobacion
      })
    })

    if (!wixResponse.ok) {
      const errorText = await wixResponse.text()
      console.error('Error de Wix:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error al actualizar aprobación en Wix' },
        { status: wixResponse.status }
      )
    }

    const wixData = await wixResponse.json()
    return NextResponse.json({
      success: true,
      data: wixData
    })

  } catch (error) {
    console.error('Error al actualizar aprobación:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}