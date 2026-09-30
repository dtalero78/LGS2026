import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { recordCronRun } from '@/lib/cron-runs'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: Generar/normalizar PEOPLE.nombreCompleto
 *
 * Llamado por cron-worker (Node.js daemon en Digital Ocean) a las 05:00 UTC
 * (00:00 Colombia) con Authorization: Bearer <CRON_SECRET>.
 *
 * `nombreCompleto` es un campo derivado (presentación) = primerNombre +
 * segundoNombre + primerApellido + segundoApellido, colapsando espacios (si el
 * segundo nombre o el segundo apellido están vacíos, NO queda doble espacio ni
 * espacio al final).
 *
 * Alcance (self-healing SIN rellenar las vacías legacy):
 *   - Contratos NUEVOS: filas vacías creadas en los últimos 3 días → las genera.
 *   - Re-normaliza cualquier fila que YA tenía valor pero quedó desincronizada.
 *   - NO toca filas vacías antiguas (created > 3 días) — respeta el estado legacy.
 *
 * Es un solo UPDATE en lote (rápido, no bloquea lecturas por MVCC).
 */

// CONCAT_WS ignora NULL pero no '' → REGEXP_REPLACE colapsa espacios, TRIM quita
// bordes, NULLIF deja NULL si todo está vacío.
const NORM = `NULLIF(TRIM(REGEXP_REPLACE(CONCAT_WS(' ', "primerNombre","segundoNombre","primerApellido","segundoApellido"), '\\s+', ' ', 'g')), '')`

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    console.log('Cron sync-nombrecompleto: Unauthorized request')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await recordCronRun('sync-nombrecompleto', async () => {
      const r = await query(
        `UPDATE "PEOPLE"
            SET "nombreCompleto" = ${NORM}, "_updatedDate" = NOW()
          WHERE ${NORM} IS NOT NULL
            AND (
              (COALESCE("nombreCompleto",'') <> '' AND "nombreCompleto" <> ${NORM})
              OR
              (COALESCE("nombreCompleto",'') = '' AND "_createdDate" >= NOW() - INTERVAL '3 days')
            )`
      )
      const n = r.rowCount || 0
      console.log(`Cron sync-nombrecompleto: ${n} fila(s) actualizada(s)`)
      return { processedCount: n, successCount: n, failedCount: 0, metadata: {} }
    })

    return NextResponse.json({
      success: true,
      message: `nombreCompleto: ${result.processedCount} fila(s) generada(s)/normalizada(s)`,
      processed: result.processedCount,
      successful: result.successCount,
      failed: result.failedCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron sync-nombrecompleto: Error general:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
