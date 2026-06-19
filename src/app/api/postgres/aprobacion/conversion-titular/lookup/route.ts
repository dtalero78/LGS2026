/**
 * POST /api/postgres/aprobacion/conversion-titular/lookup
 *   body: { contrato, numeroId } → valida que coincidan y devuelve los datos
 *   del titular (+ si ya fue convertido). Gateado por CONVERSION_TITULAR_VER.
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { lookupTitular } from '@/services/conversion-titular.service';

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.CONVERSION_TITULAR_VER);
  const body = await request.json();
  const contrato = String(body?.contrato || '').trim();
  const numeroId = String(body?.numeroId || '').trim();
  if (!contrato || !numeroId) throw new ValidationError('contrato y numeroId son requeridos');
  const result = await lookupTitular(contrato, numeroId);
  return successResponse(result);
});
