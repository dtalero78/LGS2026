import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { idEstudiante } = body

    if (!idEstudiante) {
      return NextResponse.json(
        { success: false, error: 'idEstudiante is required' },
        { status: 400 }
      )
    }

    console.log('📊 Fetching ACADEMICA data for:', idEstudiante)

    const response = await fetch(
      `${WIX_API_BASE_URL}/studentById?id=${idEstudiante}`,
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
    console.log('✅ ACADEMICA data received for:', idEstudiante)

    return NextResponse.json({
      success: true,
      student: data.student || null
    })

  } catch (error) {
    console.error('❌ Error in academica-user API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}