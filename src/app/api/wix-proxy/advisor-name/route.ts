import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const advisorId = searchParams.get('advisorId')

    if (!advisorId) {
      return NextResponse.json(
        { success: false, error: 'advisorId parameter is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Fetching advisor name for ID:', advisorId)

    const response = await fetch(
      `${WIX_API_BASE_URL}/getAdvisors`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    console.log('✅ Advisors list received, searching for ID:', advisorId)

    // Buscar el advisor específico en la lista
    if (data.success && data.advisors && Array.isArray(data.advisors)) {
      const advisor = data.advisors.find((adv: any) => adv._id === advisorId)

      if (advisor) {
        console.log('✅ Advisor encontrado:', advisor)
        return NextResponse.json({
          success: true,
          advisor: advisor
        })
      } else {
        console.log('❌ Advisor no encontrado en la lista')
        return NextResponse.json({
          success: false,
          error: 'Advisor no encontrado'
        })
      }
    } else {
      console.log('❌ Formato de respuesta inesperado:', data)
      return NextResponse.json({
        success: false,
        error: 'Formato de respuesta inesperado'
      })
    }

  } catch (error) {
    console.error('❌ Error in advisor-name API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}