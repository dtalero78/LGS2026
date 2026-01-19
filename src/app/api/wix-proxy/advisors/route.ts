import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    console.log('👨‍🏫 Fetching advisors from Wix')

    const response = await fetch(
      `${WIX_API_BASE_URL}/getAdvisors`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
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
    console.log('✅ Advisors received:', data?.advisors?.length || 0)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in advisors API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}