import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch('https://www.lgsplataforma.com/_functions/updateBeneficiario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in updateBeneficiario proxy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update beneficiary' },
      { status: 500 }
    )
  }
}