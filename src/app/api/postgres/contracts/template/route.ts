import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { buscarPlantillaContrato } from '@/lib/contract-template';

/**
 * GET /api/postgres/contracts/template?plataforma=Colombia[&tipoContrato=CANJE]
 *
 * Returns the contract template text for a given platform and contract type
 * (sin `tipoContrato` = plantilla estándar del país).
 */
export const GET = handler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const plataforma = searchParams.get('plataforma');
  const tipoContrato = searchParams.get('tipoContrato');

  if (!plataforma) {
    throw new ValidationError('plataforma query param is required');
  }

  const template = await buscarPlantillaContrato(plataforma, tipoContrato);
  if (!template) {
    throw new NotFoundError('ContractTemplate', `${plataforma}${tipoContrato ? ` (${tipoContrato})` : ''}`);
  }

  return successResponse({ template, plataforma });
});
