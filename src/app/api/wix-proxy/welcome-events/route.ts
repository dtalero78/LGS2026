import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

// Aumentar timeout para permitir cargar todos los datos
export const maxDuration = 60 // 60 segundos

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    const hasDateFilter = fechaInicio || fechaFin
    const logMessage = hasDateFilter
      ? `📅 Cargando eventos WELCOME desde ${fechaInicio || 'inicio'} hasta ${fechaFin || 'fin'}...`
      : '📅 Cargando TODOS los eventos WELCOME (pasados, presentes y futuros)...'

    console.log(logMessage)

    // Llamar al endpoint post_getWelcomeEvents de Wix con filtros de fecha opcionales
    const response = await fetch(
      `${WIX_API_BASE_URL}/getWelcomeEvents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fechaInicio,
          fechaFin
        })
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Wix API response:', errorText)
      return NextResponse.json(
        { success: false, error: `Wix API error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Datos de eventos WELCOME recibidos de Wix:', data)

    return NextResponse.json({
      success: true,
      events: data.events || data.items || [],
      total: data.total || data.totalCount || 0
    })

  } catch (error) {
    console.error('❌ Error en welcome-events API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}