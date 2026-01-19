import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function GET(request: NextRequest) {
  try {
    console.log('📚 Fetching niveles from Wix')

    const response = await fetch(
      `${WIX_API_BASE_URL}/niveles`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status, response.statusText)
      throw new Error(`Wix API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ Niveles received from Wix:', data?.niveles?.length || 0, 'Source:', data?.source || 'unknown')

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in niveles API:', error)

    // Fallback con datos estructurados básicos en caso de error
    const fallbackNiveles = [
      {
        _id: 'bn1',
        code: 'BN1',
        steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'],
        clubs: ['PRONUNCIATION - Step 1', 'GRAMMAR - Step 1', 'LISTENING - Step 1']
      },
      {
        _id: 'bn2',
        code: 'BN2',
        steps: ['Step 6', 'Step 7', 'Step 8', 'Step 9', 'Step 10'],
        clubs: ['PRONUNCIATION - Step 6', 'GRAMMAR - Step 6', 'LISTENING - Step 6']
      },
      {
        _id: 'p1',
        code: 'P1',
        steps: ['Step 16', 'Step 17', 'Step 18', 'Step 19', 'Step 20'],
        clubs: ['PRONUNCIATION - Step 16', 'GRAMMAR - Step 16', 'CONVERSATION - Step 16']
      }
    ]

    return NextResponse.json({
      success: true,
      niveles: fallbackNiveles,
      source: 'fallback_data'
    })
  }
}