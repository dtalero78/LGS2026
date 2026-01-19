import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const overrideData = await request.json()
    console.log('➕ Creating step override:', overrideData)

    const response = await fetch(
      `${WIX_API_BASE_URL}/stepOverride`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(overrideData)
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
    console.log('✅ Step override created/updated:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in step-override API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const step = searchParams.get('step')

    if (!studentId || !step) {
      return NextResponse.json(
        { success: false, error: 'studentId and step parameters are required' },
        { status: 400 }
      )
    }

    console.log('🗑️ Deleting step override:', { studentId, step })

    const response = await fetch(
      `${WIX_API_BASE_URL}/stepOverride?studentId=${encodeURIComponent(studentId)}&step=${encodeURIComponent(step)}`,
      {
        method: 'DELETE',
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
    console.log('✅ Step override deleted:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in delete step-override API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}