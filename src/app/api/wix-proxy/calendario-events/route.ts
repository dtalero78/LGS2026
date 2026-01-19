import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fechaInicio, fechaFin, advisorId } = body

    console.log('🗓️ Fetching calendar events:', { fechaInicio, fechaFin, advisorId })

    const response = await fetch(
      `${WIX_API_BASE_URL}/getCalendarioEvents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fechaInicio,
          fechaFin,
          advisorId
        })
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
    console.log('✅ Calendar events received:', data?.events?.length || 0)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in calendario-events API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}