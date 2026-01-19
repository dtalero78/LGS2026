import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: Reactivar estudiantes con OnHold vencido
 *
 * Este endpoint se ejecuta automáticamente via cron en Digital Ocean App Platform.
 * Busca estudiantes cuyo período OnHold ha vencido (fechaFinOnHold <= hoy)
 * y los reactiva automáticamente, extendiendo su vigencia.
 *
 * Configuración en Digital Ocean App Platform:
 * - Job Type: Cron
 * - Schedule: 0 6 * * * (todos los días a las 6:00 AM)
 * - HTTP Route: GET /api/cron/reactivate-onhold
 * - Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    // Validar autorización del cron job
    const authHeader = request.headers.get('authorization')
    const providedSecret = authHeader?.replace('Bearer ', '')

    // En producción, validar el secret
    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      console.log('Cron reactivate-onhold: Unauthorized request')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Cron reactivate-onhold: Iniciando proceso de reactivación automática')

    if (!WIX_API_BASE_URL) {
      console.error('Cron reactivate-onhold: WIX_API_BASE_URL no configurada')
      return NextResponse.json(
        { success: false, error: 'Configuración de Wix faltante' },
        { status: 500 }
      )
    }

    // 1. Obtener estudiantes con OnHold vencido
    const expiredResponse = await fetch(`${WIX_API_BASE_URL}/getExpiredOnHoldStudents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!expiredResponse.ok) {
      const errorText = await expiredResponse.text()
      console.error('Cron reactivate-onhold: Error obteniendo estudiantes:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error obteniendo estudiantes con OnHold vencido' },
        { status: 500 }
      )
    }

    const expiredData = await expiredResponse.json()

    if (!expiredData.success || !expiredData.students || expiredData.students.length === 0) {
      console.log('Cron reactivate-onhold: No hay estudiantes con OnHold vencido')
      return NextResponse.json({
        success: true,
        message: 'No hay estudiantes con OnHold vencido para reactivar',
        processed: 0,
        results: []
      })
    }

    const students = expiredData.students
    console.log(`Cron reactivate-onhold: Encontrados ${students.length} estudiantes con OnHold vencido`)

    // 2. Reactivar cada estudiante
    const results: Array<{
      studentId: string
      nombre: string
      success: boolean
      error?: string
      diasExtendidos?: number
    }> = []

    for (const student of students) {
      try {
        console.log(`Cron reactivate-onhold: Reactivando estudiante ${student._id} - ${student.primerNombre} ${student.primerApellido}`)

        const reactivateResponse = await fetch(`${WIX_API_BASE_URL}/toggleUserStatus`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: student._id,
            setInactive: false,
            // No enviamos fechas porque estamos desactivando OnHold
            fechaOnHold: null,
            fechaFinOnHold: null,
            motivo: null,
            // Flag para indicar que es una reactivación automática
            automaticReactivation: true
          })
        })

        if (reactivateResponse.ok) {
          const reactivateData = await reactivateResponse.json()
          console.log(`Cron reactivate-onhold: Estudiante ${student._id} reactivado exitosamente`)

          results.push({
            studentId: student._id,
            nombre: `${student.primerNombre} ${student.primerApellido}`,
            success: true,
            diasExtendidos: reactivateData.diasExtendidos || 0
          })
        } else {
          const errorText = await reactivateResponse.text()
          console.error(`Cron reactivate-onhold: Error reactivando estudiante ${student._id}:`, errorText)

          results.push({
            studentId: student._id,
            nombre: `${student.primerNombre} ${student.primerApellido}`,
            success: false,
            error: errorText
          })
        }
      } catch (studentError) {
        console.error(`Cron reactivate-onhold: Error procesando estudiante ${student._id}:`, studentError)

        results.push({
          studentId: student._id,
          nombre: `${student.primerNombre} ${student.primerApellido}`,
          success: false,
          error: studentError instanceof Error ? studentError.message : 'Error desconocido'
        })
      }
    }

    // 3. Generar resumen
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`Cron reactivate-onhold: Proceso completado. Exitosos: ${successful}, Fallidos: ${failed}`)

    return NextResponse.json({
      success: true,
      message: `Proceso completado. ${successful} estudiantes reactivados, ${failed} fallidos.`,
      processed: students.length,
      successful,
      failed,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cron reactivate-onhold: Error general:', error)
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

// También soportar POST para pruebas manuales
export async function POST(request: NextRequest) {
  return GET(request)
}
