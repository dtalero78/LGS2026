import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { recordCronRun } from '@/lib/cron-runs'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: revertir las marcas "Opcional" TEMPORALES que ya vencieron.
 *
 * Llamado por cron-worker (daemon Node.js en Digital Ocean) a las 01:00 UTC
 * todos los días con Authorization: Bearer <CRON_SECRET>.
 *
 * Una marca Opcional temporal lleva `marcaOpcionalHasta` (DATE) y
 * `marcaOpcionalAnterior` (el valor al que hay que volver). Cuando la fecha
 * queda atrás, la marca vuelve sola a ese valor anterior.
 *
 * Regla de vencimiento: se revierte cuando `marcaOpcionalHasta < CURRENT_DATE`,
 * o sea el día SIGUIENTE al indicado — el día elegido por el usuario es el
 * último en que la marca sigue vigente.
 *
 * Esto es la segunda mitad del mecanismo: la vista de asignación YA ignora las
 * marcas vencidas al consultarlas, así que la pantalla es correcta desde el
 * minuto uno. Este cron es el que deja limpio el dato en la base.
 *
 * Cada ejecución queda registrada en CRON_RUNS via recordCronRun(), y
 * /api/cron/health-check expone la última corrida.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')

  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resultado = await recordCronRun('revertir-marca-opcional', async () => {
      // Se revierte al valor anterior (normalmente NULL) y se limpian los
      // campos de vigencia. RETURNING para poder dejar traza de a quién afectó.
      const { rows } = await query<{
        _id: string
        contrato: string | null
        primerNombre: string | null
        primerApellido: string | null
        marcaOpcionalHasta: string | null
      }>(
        `UPDATE "PEOPLE"
            SET "marcaOpcional" = "marcaOpcionalAnterior",
                "marcaOpcionalHasta" = NULL,
                "marcaOpcionalAnterior" = NULL,
                "_updatedDate" = NOW()
          WHERE "marcaOpcionalHasta" IS NOT NULL
            AND "marcaOpcionalHasta" < CURRENT_DATE
          RETURNING "_id", "contrato", "primerNombre", "primerApellido", "marcaOpcionalHasta"`,
      )

      const details = rows.map((r) => ({
        id: r._id,
        contrato: r.contrato,
        titular: [r.primerNombre, r.primerApellido].filter(Boolean).join(' ').trim() || null,
        vencioEl: r.marcaOpcionalHasta,
      }))

      console.log(`🔄 [Cron] Marcas Opcional revertidas por vencimiento: ${rows.length}`)

      return {
        processedCount: rows.length,
        successCount: rows.length,
        failedCount: 0,
        metadata: { details },
      }
    })

    return NextResponse.json({
      success: true,
      revertidas: resultado.processedCount,
      detalle: resultado.metadata?.details ?? [],
    })
  } catch (error) {
    console.error('❌ [Cron] revertir-marca-opcional:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 },
    )
  }
}
