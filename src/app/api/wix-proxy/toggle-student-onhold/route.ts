import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { studentId, setOnHold, fechaOnHold, fechaFinOnHold, motivo } = body

    console.log('📡 API toggle-student-onhold recibió:', {
      studentId,
      setOnHold,
      fechaOnHold,
      fechaFinOnHold,
      motivo
    })

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'studentId es requerido' },
        { status: 400 }
      )
    }

    // Llamar a la función toggleUserStatus en Wix (solo para este estudiante)
    const wixApiUrl = `${process.env.NEXT_PUBLIC_WIX_API_BASE_URL}/toggleUserStatus`

    const response = await fetch(wixApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: studentId,
        setInactive: setOnHold,
        // Agregar fechas y motivo para guardarlas en PEOPLE
        fechaOnHold: setOnHold ? fechaOnHold : null,
        fechaFinOnHold: setOnHold ? fechaFinOnHold : null,
        motivo: setOnHold ? motivo : null
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error de Wix API:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error al comunicarse con Wix' },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log('✅ Respuesta de Wix toggleUserStatus:', data)

    return NextResponse.json({
      success: true,
      message: `Estudiante ${setOnHold ? 'inactivado' : 'activado'} exitosamente`,
      data: data
    })

  } catch (error) {
    console.error('❌ Error en API toggle-student-onhold:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
