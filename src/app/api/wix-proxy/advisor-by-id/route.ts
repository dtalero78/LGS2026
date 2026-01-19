import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const advisorId = searchParams.get('id')

    console.log('👨‍🏫 Fetching advisor by ID:', advisorId)

    if (!advisorId) {
      return NextResponse.json(
        { success: false, error: 'Advisor ID is required' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${WIX_API_BASE_URL}/advisorById/${advisorId}`,
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
    console.log('✅ Advisor data received:', data?.advisor?.nombreCompleto || 'Unknown')

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in advisor-by-id API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}