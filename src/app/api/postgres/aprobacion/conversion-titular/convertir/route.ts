/**
 * POST /api/postgres/aprobacion/conversion-titular/convertir
 *   body: { contrato, numeroId } → duplica el titular como BENEFICIARIO (PEOPLE)
 *   + lo ubica en WELCOME (ACADEMICA), transaccional. Gateado por
 *   CONVERSION_TITULAR_VER.
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { convertirTitular } from '@/services/conversion-titular.service';

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.CONVERSION_TITULAR_VER);
  const body = await request.json();
  const contrato = String(body?.contrato || '').trim();
  const numeroId = String(body?.numeroId || '').trim();
  if (!contrato || !numeroId) throw new ValidationError('contrato y numeroId son requeridos');
  const result = await convertirTitular(contrato, numeroId);
  return successResponse(result);
});
