import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { extraerNumeroFacturaDesdeUrl } from '@/services/factura-extract.service';

/**
 * POST /api/postgres/recaudos/factura-numero/extraer
 * Body: { url }  → lee el número de factura del archivo (NO guarda nada).
 * Lo usa el modal "Facturar" del Centro de Validación para proponer el # Factura.
 * Gate: PAGOS_FACTURAR (el mismo de registrar la factura). Solo archivos de nuestro bucket.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, PersonPermission.PAGOS_FACTURAR);
  const body = await req.json().catch(() => ({}));
  const url = String(body?.url || '').trim();
  if (!url) throw new ValidationError('url del archivo es requerida.');
  const extraido = await extraerNumeroFacturaDesdeUrl(url);
  return successResponse({ extraido });
});
