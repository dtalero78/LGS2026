import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { beneficiaryId, numeroId } = body

    // La función deleteBeneficiario en Wix solo necesita el beneficiarioId
    const wixPayload = {
      beneficiarioId: beneficiaryId
    }

    console.log('🗑️ Enviando solicitud de eliminación a Wix:', wixPayload)

    const response = await fetch('https://www.lgsplataforma.com/_functions/deleteBeneficiario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wixPayload)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ Respuesta de Wix:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in deleteBeneficiario proxy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete beneficiary' },
      { status: 500 }
    )
  }
}