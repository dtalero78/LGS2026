import { NextRequest, NextResponse } from 'next/server'
import { recordCronRun } from '@/lib/cron-runs'
import { sincronizarGuiasKids } from '@/lib/kids-guias-sync'
import { tomarFacturasKids } from '@/lib/kids-facturas-guias'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: guías de KIDS → LGS (cada 15 min, cron-worker).
 * Usuario, clave (hash argon2id), estado y ficha de cada guía nacen en KIDS y se reflejan
 * en USUARIOS_ROLES + ADVISORS (lib/kids-guias-sync.ts). Además, un ingreso fallido en LGS
 * refresca al instante solo a ese guía (auth-postgres).
 */
export async function GET(request: NextRequest) {
  const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    let detalle: any[] = []
    let facturas: any[] = []
    const result = await recordCronRun('sync-guias-kids', async () => {
      detalle = await sincronizarGuiasKids()
      // Facturas que las guías subieron en KIDS y no llegaron por el aviso inmediato.
      facturas = await tomarFacturasKids().catch((e) => { console.warn('Cron sync-guias-kids: facturas', e?.message); return [] })
      const ok = detalle.filter(d => d.estado === 'creada' || d.estado === 'actualizada').length
      const fallidas = detalle.filter(d => d.estado === 'error').length
      return { processedCount: detalle.length, successCount: ok, failedCount: fallidas, metadata: { detalle, facturas } }
    })
    return NextResponse.json({
      success: true,
      message: `Guías KIDS: ${result.successCount} sincronizada(s), ${result.failedCount} con error, ${detalle.filter(d => d.estado === 'pendiente').length} pendiente(s) · facturas tomadas: ${facturas.length}`,
      detalle,
      facturas,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron sync-guias-kids: Error general:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
