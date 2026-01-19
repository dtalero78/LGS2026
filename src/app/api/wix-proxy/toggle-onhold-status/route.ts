import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { contrato, titularId, beneficiaryIds, setOnHold, fechaOnHold, fechaFinOnHold } = await request.json()

    if (!contrato || !titularId || setOnHold === undefined) {
      return NextResponse.json(
        { success: false, error: 'contrato, titularId y setOnHold son requeridos' },
        { status: 400 }
      )
    }

    if (setOnHold && (!fechaOnHold || !fechaFinOnHold)) {
      return NextResponse.json(
        { success: false, error: 'fechaOnHold y fechaFinOnHold son requeridos para activar OnHold' },
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

    const wixUrl = `${WIX_API_BASE_URL}/toggleOnHoldStatus`

    console.log('🔄 Proxy: Toggle OnHold status', {
      contrato,
      titularId,
      beneficiaryCount: beneficiaryIds?.length || 0,
      setOnHold,
      fechaOnHold,
      fechaFinOnHold
    })

    const wixResponse = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contrato,
        titularId,
        beneficiaryIds: beneficiaryIds || [],
        setOnHold,
        fechaOnHold,
        fechaFinOnHold
      })
    })

    if (!wixResponse.ok) {
      const errorText = await wixResponse.text()
      console.error('Error de Wix:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error al cambiar estado OnHold en Wix' },
        { status: wixResponse.status }
      )
    }

    const wixData = await wixResponse.json()

    console.log('✅ OnHold actualizado exitosamente:', {
      contrato,
      onHoldStatus: setOnHold
    })

    return NextResponse.json({
      success: true,
      data: wixData
    })

  } catch (error) {
    console.error('Error al cambiar estado OnHold:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
