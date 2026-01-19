import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personId, nuevoEstado } = body

    if (!personId || !nuevoEstado) {
      return NextResponse.json(
        { success: false, error: 'personId and nuevoEstado are required' },
        { status: 400 }
      )
    }

    console.log('🔄 Enviando solicitud de actualización de estado a Wix:', { personId, nuevoEstado })

    const response = await fetch('https://www.lgsplataforma.com/_functions/updateTitularEstado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personId,
        nuevoEstado
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ Respuesta de Wix:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in updateTitularEstado proxy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update titular estado' },
      { status: 500 }
    )
  }
}