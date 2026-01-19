import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { advisorId, fechaInicio, fechaFin } = body

    const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

    const response = await fetch(`${WIX_API_BASE_URL}/getAdvisorStats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        advisorId,
        fechaInicio,
        fechaFin
      })
    })

    if (!response.ok) {
      throw new Error(`Error fetching advisor stats: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in advisor-stats proxy:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch advisor stats' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}