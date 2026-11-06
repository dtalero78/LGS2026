import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { exigirClaveKids } from '@/lib/kids-sync-server';
import { tomarFacturasKids, quitarFacturaDesdeKids } from '@/lib/kids-facturas-guias';

/**
 * POST /api/kids-sync/factura-guia — KIDS avisa que una guía subió una factura.
 * Body: { facturaId }. LGS la toma desde KIDS (archivo incluido), la pasa por el flujo
 * de Gestión Advisors (lectura IA, inconsistencias) y le responde/informa el estado
 * (RECIBIDA o RECHAZADA con motivo). Si este aviso falla, el cron la recoge después.
 * Body { facturaId, accion: 'quitar' }: la guía la retiró en KIDS → se retira aquí
 * (error si ya no se puede, y entonces KIDS tampoco la quita).
 */
export const POST = handler(async (request) => {
  exigirClaveKids(request);
  const body = await request.json().catch(() => ({}));
  const id = String(body?.facturaId || '').trim();
  if (body?.accion === 'quitar') {
    if (!id) return successResponse({ quitada: false });
    return successResponse(await quitarFacturaDesdeKids(id));
  }
  const r = await tomarFacturasKids(id || undefined);
  return successResponse({ resultado: id ? r.find((x) => x.id === id) ?? null : r });
});
