import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || ''

/**
 * POST /api/informes/beneficiarios
 * Obtiene todos los beneficiarios en un rango de fechas con su total de sesiones
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: 'fechaInicio y fechaFin son requeridos' },
        { status: 400 }
      )
    }

    console.log('📊 Generando informe de beneficiarios:', { fechaInicio, fechaFin })

    // Llamar a la función de Wix
    const response = await fetch(`${WIX_API_BASE_URL}/getBeneficiariosByDateRange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fechaInicio,
        fechaFin,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en Wix API:', errorText)
      throw new Error(`Error en Wix API: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Error obteniendo beneficiarios')
    }

    console.log(`✅ Informe generado: ${data.beneficiarios?.length || 0} beneficiarios`)

    return NextResponse.json({
      success: true,
      beneficiarios: data.beneficiarios || [],
      total: data.total || 0,
    })
  } catch (error) {
    console.error('❌ Error en /api/informes/beneficiarios:', error)
    return NextResponse.json(
      {
        error: 'Error generando el informe',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
