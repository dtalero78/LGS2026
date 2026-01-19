import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, nivel } = body

    console.log('🤖 Generate Student Activity Proxy:', { studentId, nivel })

    if (!studentId || !nivel) {
      return NextResponse.json(
        { error: 'studentId and nivel are required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/generateStudentActivity`
    console.log('🤖 Making request to:', wixUrl)

    const response = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studentId, nivel })
    })

    console.log('🤖 Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      return NextResponse.json({
        success: false,
        error: `Wix API error: ${response.status} ${response.statusText}`
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('✅ Activity generated successfully')
    return NextResponse.json(data)

  } catch (error) {
    console.error('🤖 Generate Student Activity Proxy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
