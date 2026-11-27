import { NextRequest, NextResponse } from 'next/server'
import { recordCronRun } from '@/lib/cron-runs'
import { procesarPapeleraCron } from '@/services/libro-papelera.service'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: Papelera del Libro de Producción (06:00 UTC = 01:00 Colombia, cron-worker).
 *   1) Devuelve a su pestaña lo que ya no cumple la regla (se completó, cambió de estado,
 *      tiene pagos validados o clases).
 *   2) Envía a la Papelera lo que lleva 15 días en «Por resolver» sin pagos validados ni clases.
 *   3) Borra lo que lleva 30 días en la Papelera (PURGE_LOG tipo PAPELERA_AUTO).
 * Reglas en src/services/libro-papelera.service.ts.
 */
export async function GET(request: NextRequest) {
  const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    let detalle: any = null
    const result = await recordCronRun('papelera-libro', async () => {
      const r = await procesarPapeleraCron()
      detalle = r
      console.log(`Cron papelera-libro: ${r.devueltos} devuelto(s), ${r.enviados} enviado(s), ${r.borrados} borrado(s), ${r.omitidos.length} omitido(s)`)
      if (r.omitidos.length) console.log('Cron papelera-libro omitidos:', r.omitidos.join(', '))
      const n = r.devueltos + r.enviados + r.borrados
      return { processedCount: n + r.omitidos.length, successCount: n, failedCount: r.omitidos.length, metadata: r }
    })
    return NextResponse.json({
      success: true,
      message: `Papelera: ${detalle?.devueltos ?? 0} devuelto(s), ${detalle?.enviados ?? 0} enviado(s), ${detalle?.borrados ?? 0} borrado(s), ${detalle?.omitidos?.length ?? 0} omitido(s)`,
      processed: result.processedCount,
      ...detalle,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron papelera-libro: Error general:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
