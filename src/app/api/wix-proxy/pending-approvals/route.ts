import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL

export async function GET(request: NextRequest) {
  try {
    console.log('📥 API Route: Obteniendo registros pendientes de aprobación')

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { success: false, error: 'WIX_API_BASE_URL no configurada' },
        { status: 500 }
      )
    }

    // Llamar a la función de Wix
    const response = await fetch(`${WIX_API_BASE_URL}/getPendingApprovals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Error en respuesta de Wix:', response.status)
      return NextResponse.json(
        { success: false, error: 'Error al obtener registros de Wix' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Registros pendientes obtenidos:', data.totalRecords || 0)

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error en API route pending-approvals:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
