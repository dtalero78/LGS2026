import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const WIX_API_KEY = process.env.WIX_API_KEY
const WIX_SECRET = process.env.WIX_SECRET

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Beneficiarios Sin Registro Proxy: WIX_API_BASE_URL =', WIX_API_BASE_URL)

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    // Agregar timestamp para evitar cache
    const wixUrl = `${WIX_API_BASE_URL}/beneficiariosSinRegistro?_t=${Date.now()}`
    console.log('🔍 Beneficiarios Sin Registro Proxy: Making request to =', wixUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }

    if (WIX_API_KEY) {
      headers['Authorization'] = `Bearer ${WIX_API_KEY}`
    }

    if (WIX_SECRET) {
      headers['X-Wix-Secret'] = WIX_SECRET
    }

    console.log('🔍 Beneficiarios Sin Registro Proxy: Headers =', Object.keys(headers))

    const response = await fetch(wixUrl, {
      method: 'GET',
      headers,
    })

    console.log('🔍 Beneficiarios Sin Registro Proxy: Response status =', response.status)

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
    console.log('🔍 Beneficiarios Sin Registro Proxy: Success, data count =', data.data?.people?.length || 0)

    // Log stats if available
    if (data.stats) {
      console.log('📊 Stats recibidas de Wix:', data.stats)
    }

    // Log específico para debug
    console.log('🔍 Debug: beneficiariosSinRegistro =', data.stats?.beneficiariosSinRegistro)
    console.log('🔍 Debug: data.data.people length =', data.data?.people?.length)

    return NextResponse.json(data)

  } catch (error) {
    console.error('🔍 Beneficiarios Sin Registro Proxy error:', error)
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: 'Internal server error'
    })
  }
}