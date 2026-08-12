import { NextRequest, NextResponse } from 'next/server'
import { recordCronRun } from '@/lib/cron-runs'
import { senceService } from '@/services/sence.service'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: Envío nocturno de avance de alumnos SENCE a SIC
 *
 * Llamado por cron-worker (Node.js daemon en Digital Ocean) todas las
 * noches, dentro de la ventana 22:00-00:00 hora Chile que exige el
 * instructivo de SENCE, con Authorization: Bearer <CRON_SECRET>.
 *
 * Cada ejecución queda registrada en CRON_RUNS via recordCronRun() — el
 * endpoint /api/cron/health-check expone la última ejecución para detectar
 * si el cron lleva mucho sin correr.
 *
 * NOTA: `senceService.enviarAvanceNocturno()` todavía lanza a propósito
 * (ver TODO en src/services/sence.service.ts) hasta que se defina de dónde
 * sale el universo de alumnos/cursos SENCE a reportar. Mientras tanto este
 * cron quedará registrado en CRON_RUNS con status='error', lo cual es
 * esperado y visible en el health-check.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    console.log('Cron sence-envio-avance: Unauthorized request')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await recordCronRun('sence-envio-avance', async () => {
      console.log('Cron sence-envio-avance: Iniciando envío nocturno de avance a SENCE')
      const outcome = await senceService.enviarAvanceNocturno()
      console.log(
        `Cron sence-envio-avance: Proceso completado. Exitosos: ${outcome.successCount}, Fallidos: ${outcome.failedCount}`
      )
      return outcome
    })

    return NextResponse.json({
      success: true,
      message: result.processedCount === 0
        ? 'No hay cursos SENCE para enviar'
        : `Proceso completado. ${result.successCount} cursos enviados, ${result.failedCount} fallidos.`,
      processed: result.processedCount,
      successful: result.successCount,
      failed: result.failedCount,
      results: result.metadata?.details ?? [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cron sence-envio-avance: Error general:', error)
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

export async function POST(request: NextRequest) {
  return GET(request)
}
