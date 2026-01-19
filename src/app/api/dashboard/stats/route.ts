import { NextRequest, NextResponse } from 'next/server'
import { WIX_API_BASE_URL } from '@/lib/wix'

export async function POST(request: NextRequest) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const wixUrl = `${WIX_API_BASE_URL}/getDashboardStats`

    console.log('📊 Dashboard Stats: Calling Wix API:', wixUrl)

    const response = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      console.log('📊 Dashboard Stats: Wix response:', data)

      if (data.success && data.stats) {
        return NextResponse.json({
          success: true,
          stats: data.stats,
          source: 'wix'
        })
      } else {
        console.log('📊 Dashboard Stats: Wix returned error, using fallback')
        return NextResponse.json({
          success: true,
          stats: {
            totalUsuarios: 0,
            totalInactivos: 0,
            sesionesHoy: 0,
            usuariosInscritosHoy: 0,
            advisorsHoy: 0
          },
          source: 'fallback'
        })
      }
    } else {
      console.log(`📊 Dashboard Stats: HTTP ${response.status}, using fallback`)
      return NextResponse.json({
        success: true,
        stats: {
          totalUsuarios: 0,
          totalInactivos: 0,
          sesionesHoy: 0,
          usuariosInscritosHoy: 0,
          advisorsHoy: 0
        },
        source: 'fallback'
      })
    }
  } catch (error: any) {
    console.error('📊 Dashboard Stats Error:', error.message)

    return NextResponse.json({
      success: true,
      stats: {
        totalUsuarios: 0,
        totalInactivos: 0,
        sesionesHoy: 0,
        usuariosInscritosHoy: 0,
        advisorsHoy: 0
      },
      source: 'fallback',
      error: error.message
    })
  }
}