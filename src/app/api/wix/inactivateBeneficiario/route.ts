import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { beneficiaryId } = body

    // La función inactivateBeneficiario en Wix solo necesita el beneficiarioId
    const wixPayload = {
      beneficiarioId: beneficiaryId
    }

    console.log('🔄 Enviando solicitud de inactivación a Wix:', wixPayload)

    const response = await fetch('https://www.lgsplataforma.com/_functions/inactivateBeneficiario', {
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
    console.error('Error in inactivateBeneficiario proxy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to inactivate beneficiary' },
      { status: 500 }
    )
  }
}