import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = searchParams.get('nivel')
    const studentId = searchParams.get('studentId')

    if (!nivel || !studentId) {
      return NextResponse.json(
        { success: false, error: 'nivel and studentId parameters are required' },
        { status: 400 }
      )
    }

    console.log('📊 Loading level steps:', { nivel, studentId })

    const response = await fetch(
      `${WIX_API_BASE_URL}/levelSteps?nivel=${encodeURIComponent(nivel)}&studentId=${encodeURIComponent(studentId)}`,
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
    console.log('✅ Level steps loaded:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in level-steps API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}