import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { advisorId, fechaInicio, fechaFin } = body

    console.log('📅 Calendario Events By Advisor Proxy:', { advisorId, fechaInicio, fechaFin })

    if (!advisorId) {
      return NextResponse.json(
        { success: false, error: 'advisorId is required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { success: false, error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/getCalendarioEventsByAdvisor`
    console.log('📅 Making request to:', wixUrl)

    const response = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ advisorId, fechaInicio, fechaFin })
    })

    console.log('📅 Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      return NextResponse.json({
        success: false,
        error: `Wix API error: ${response.status} ${response.statusText}`
      }, { status: response.status })
    }

    const data = await response.json()
    const eventCount = data.events?.length || data.eventos?.length || 0
    console.log('📅 Success, eventos count:', eventCount)
    return NextResponse.json(data)

  } catch (error) {
    console.error('📅 Calendario Events By Advisor Proxy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
