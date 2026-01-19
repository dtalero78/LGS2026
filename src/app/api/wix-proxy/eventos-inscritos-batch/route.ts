import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventIds } = body

    console.log('🔢📊 Proxy: Solicitud de conteo de inscritos para múltiples eventos:', eventIds?.length || 0)

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Array de IDs de eventos requerido' },
        { status: 400 }
      )
    }

    const response = await fetch(`${WIX_API_BASE_URL}/getMultipleEventsInscritosCount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventIds })
    })

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status)
      return NextResponse.json(
        { success: false, error: `Error del servidor Wix: ${response.status}`, inscritosCounts: {} },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log('🔍 DEBUG - Respuesta RAW de Wix:', JSON.stringify(data, null, 2))

    // Mapear la respuesta de Wix al formato que espera el frontend
    const mappedData = {
      success: data.success,
      inscritosCounts: data.inscritosPorEvento || {},
      asistenciasCounts: data.asistenciasPorEvento || {},
      totalEventos: data.totalEventos,
      totalBookings: data.totalBookings
    }

    console.log('✅ Conteo múltiple de inscritos recibido:', Object.keys(mappedData.inscritosCounts || {}).length, 'eventos')
    console.log('✅ Conteo múltiple de asistencias recibido:', Object.keys(mappedData.asistenciasCounts || {}).length, 'eventos')
    console.log('🔍 DEBUG - Evento c33e7197:', mappedData.inscritosCounts['c33e7197-a553-4823-a741-0c8c17a1388d'])


    return NextResponse.json(mappedData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ Error en eventos-inscritos-batch proxy:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', inscritosCounts: {} },
      { status: 500 }
    )
  }
}