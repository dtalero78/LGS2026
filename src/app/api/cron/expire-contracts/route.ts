import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: Marcar contratos expirados como FINALIZADA
 *
 * Este endpoint se ejecuta automáticamente via cron.
 * Busca estudiantes cuyo contrato ha vencido (finalContrato < hoy)
 * y los marca como:
 * - estado: "FINALIZADA"
 * - estadoInactivo: true
 *
 * Schedule recomendado: 0 12 * * * (todos los días a las 12:00 UTC / 7:00 AM Colombia)
 */
export async function GET(request: NextRequest) {
  try {
    // Validar autorización del cron job
    const authHeader = request.headers.get('authorization')
    const providedSecret = authHeader?.replace('Bearer ', '')

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      console.log('Cron expire-contracts: Unauthorized request')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Cron expire-contracts: Iniciando proceso de verificación de contratos expirados')

    if (!WIX_API_BASE_URL) {
      console.error('Cron expire-contracts: WIX_API_BASE_URL no configurada')
      return NextResponse.json(
        { success: false, error: 'Configuración de Wix faltante' },
        { status: 500 }
      )
    }

    // 1. Obtener estudiantes con contrato expirado
    const expiredResponse = await fetch(`${WIX_API_BASE_URL}/getExpiredContracts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!expiredResponse.ok) {
      const errorText = await expiredResponse.text()
      console.error('Cron expire-contracts: Error obteniendo contratos:', errorText)
      return NextResponse.json(
        { success: false, error: 'Error obteniendo contratos expirados' },
        { status: 500 }
      )
    }

    const expiredData = await expiredResponse.json()

    if (!expiredData.success || !expiredData.students || expiredData.students.length === 0) {
      console.log('Cron expire-contracts: No hay contratos expirados para procesar')
      return NextResponse.json({
        success: true,
        message: 'No hay contratos expirados para procesar',
        processed: 0,
        results: []
      })
    }

    const students = expiredData.students
    console.log(`Cron expire-contracts: Encontrados ${students.length} contratos expirados`)

    // 2. Marcar cada estudiante como FINALIZADA
    const results: Array<{
      studentId: string
      nombre: string
      success: boolean
      error?: string
      finalContrato?: string
    }> = []

    for (const student of students) {
      try {
        console.log(`Cron expire-contracts: Marcando contrato expirado ${student._id} - ${student.primerNombre} ${student.primerApellido}`)

        const updateResponse = await fetch(`${WIX_API_BASE_URL}/markContractExpired`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personId: student._id
          })
        })

        if (updateResponse.ok) {
          const updateData = await updateResponse.json()
          console.log(`Cron expire-contracts: Estudiante ${student._id} marcado como FINALIZADA`)

          results.push({
            studentId: student._id,
            nombre: `${student.primerNombre} ${student.primerApellido}`,
            success: true,
            finalContrato: student.finalContrato
          })
        } else {
          const errorText = await updateResponse.text()
          console.error(`Cron expire-contracts: Error marcando estudiante ${student._id}:`, errorText)

          results.push({
            studentId: student._id,
            nombre: `${student.primerNombre} ${student.primerApellido}`,
            success: false,
            error: errorText
          })
        }
      } catch (studentError) {
        console.error(`Cron expire-contracts: Error procesando estudiante ${student._id}:`, studentError)

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

    console.log(`Cron expire-contracts: Proceso completado. Exitosos: ${successful}, Fallidos: ${failed}`)

    return NextResponse.json({
      success: true,
      message: `Proceso completado. ${successful} contratos marcados como FINALIZADA, ${failed} fallidos.`,
      processed: students.length,
      successful,
      failed,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cron expire-contracts: Error general:', error)
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
