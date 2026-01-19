import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personId, commentData } = body

    if (!personId || !commentData) {
      return NextResponse.json(
        { success: false, error: 'personId y commentData son requeridos' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { success: false, error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/addCommentToPerson`

    const response = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ personId, commentData })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, errorText)
      return NextResponse.json({
        success: false,
        error: `Wix API error: ${response.status}`
      })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Add comment proxy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}