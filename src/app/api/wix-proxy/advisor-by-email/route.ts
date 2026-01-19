import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    console.log('🔍 Advisor By Email Proxy: email =', email)
    console.log('🔍 Advisor By Email Proxy: WIX_API_BASE_URL =', WIX_API_BASE_URL)

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { success: false, error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/advisorByEmail?email=${encodeURIComponent(email)}`
    console.log('🔍 Advisor By Email Proxy: Making request to =', wixUrl)

    const response = await fetch(wixUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('🔍 Advisor By Email Proxy: Response status =', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      return NextResponse.json({
        success: false,
        error: `Wix API error: ${response.status} ${response.statusText}`
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('🔍 Advisor By Email Proxy: Success, data =', JSON.stringify(data, null, 2))
    return NextResponse.json(data)

  } catch (error) {
    console.error('🔍 Advisor By Email Proxy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
