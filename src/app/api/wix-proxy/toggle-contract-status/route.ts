import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { contrato, titularId, beneficiaryIds, setInactive } = await request.json()

    if (!contrato || !titularId || setInactive === undefined) {
      return NextResponse.json(
        { success: false, error: 'contrato, titularId y setInactive son requeridos' },
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

    const wixUrl = `${WIX_API_BASE_URL}/toggleContractStatus`

    console.log('🔄 Proxy: Toggle contract status', {
      contrato,
      titularId,
      beneficiaryCount: beneficiaryIds?.length || 0,
      setInactive
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
        setInactive
      })
    })

    if (!wixResponse.ok) {
      const errorText = await wixResponse.text()
      console.error('Error de Wix:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error al cambiar estado del contrato en Wix' },
        { status: wixResponse.status }
      )
    }

    const wixData = await wixResponse.json()

    console.log('✅ Contrato actualizado exitosamente:', {
      contrato,
      updatedCount: wixData.updatedCount
    })

    return NextResponse.json({
      success: true,
      updatedCount: wixData.updatedCount,
      data: wixData
    })

  } catch (error) {
    console.error('Error al cambiar estado del contrato:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
