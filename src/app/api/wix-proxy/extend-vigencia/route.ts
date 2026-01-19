import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { studentId, nuevaFechaFinal, motivo } = await request.json()

    if (!studentId || !nuevaFechaFinal) {
      return NextResponse.json(
        { success: false, error: 'studentId y nuevaFechaFinal son requeridos' },
        { status: 400 }
      )
    }

    const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL

    if (!WIX_API_BASE_URL) {
      console.error('WIX_API_BASE_URL no configurada')
      return NextResponse.json(
        { success: false, error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/extendStudentVigencia`

    console.log('🔄 Proxy: Extender vigencia de estudiante individual', {
      studentId,
      nuevaFechaFinal,
      motivo: motivo || 'Sin motivo especificado'
    })

    const wixResponse = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId,
        nuevaFechaFinal,
        motivo: motivo || ''
      })
    })

    if (!wixResponse.ok) {
      const errorText = await wixResponse.text()
      console.error('Error de Wix:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error al extender vigencia en Wix' },
        { status: wixResponse.status }
      )
    }

    const wixData = await wixResponse.json()

    console.log('✅ Vigencia extendida exitosamente para estudiante:', {
      studentId,
      nuevaFechaFinal,
      extensionNumero: wixData.data?.extensionNumero
    })

    return NextResponse.json({
      success: true,
      data: wixData
    })

  } catch (error) {
    console.error('Error al extender vigencia:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
