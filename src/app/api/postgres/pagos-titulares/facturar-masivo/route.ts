/**
 * API: /api/postgres/pagos-titulares/facturar-masivo
 *
 * POST { ids: string[], numeroFactura, documento? }
 *   → factura EN BLOQUE los pagos verificados indicados aplicando el MISMO
 *     número de factura (y, opcional, el mismo archivo) a todos. Omite los que
 *     no existen, no están verificados o ya tienen factura.
 *
 * Gateado por RECAUDOS.APROBACION_MASIVA (operación en bloque) +
 * PERSON.FINANCIERA.PAGOS_FACTURAR (permiso de facturar). SUPER_ADMIN/ADMIN
 * hacen bypass de ambos.
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { RecaudosPermission, PersonPermission } from '@/types/permissions';
import { pagosTitularesService } from '@/services/pagos-titulares.service';
import { ValidationError } from '@/lib/errors';

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, RecaudosPermission.APROBACION_MASIVA);
  await requirePermission(session, PersonPermission.PAGOS_FACTURAR);

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x)).filter(Boolean) : [];
  if (ids.length === 0) throw new ValidationError('Debes enviar al menos un id en "ids"');
  if (ids.length > 500) throw new ValidationError('Máximo 500 por operación');

  const numeroFactura = (body?.numeroFactura ?? '').toString();
  const documento = body?.documento && typeof body.documento === 'object' ? body.documento : null;

  const result = await pagosTitularesService.facturarMasivo(ids, numeroFactura, documento);
  return successResponse(result);
});
