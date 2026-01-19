import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const WIX_API_KEY = process.env.WIX_API_KEY
const WIX_SECRET = process.env.WIX_SECRET

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipoUsuario = searchParams.get('tipoUsuario') || 'TITULAR'

    console.log('📋 Contratos By Tipo Proxy: tipoUsuario =', tipoUsuario)
    console.log('📋 Contratos By Tipo Proxy: WIX_API_BASE_URL =', WIX_API_BASE_URL)

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/contratosByTipo?tipoUsuario=${encodeURIComponent(tipoUsuario)}`
    console.log('📋 Contratos By Tipo Proxy: Making request to =', wixUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (WIX_API_KEY) {
      headers['Authorization'] = `Bearer ${WIX_API_KEY}`
    }

    if (WIX_SECRET) {
      headers['X-Wix-Secret'] = WIX_SECRET
    }

    const response = await fetch(wixUrl, {
      method: 'GET',
      headers,
    })

    console.log('📋 Contratos By Tipo Proxy: Response status =', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      return NextResponse.json({
        success: false,
        data: { people: [], academica: [] },
        totalCount: 0,
        error: `Wix API error: ${response.status} ${response.statusText}`
      })
    }

    const data = await response.json()
    console.log('📋 Contratos By Tipo Proxy: Success, data count =', data.data?.people?.length || 0)
    return NextResponse.json(data)

  } catch (error) {
    console.error('📋 Contratos By Tipo Proxy error:', error)
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: 'Internal server error'
    })
  }
}