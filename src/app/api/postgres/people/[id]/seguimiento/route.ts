import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { seguimientoContrato } from '@/services/seguimiento-contrato.service';

/**
 * GET /api/postgres/people/[id]/seguimiento
 * Bitácora del contrato de la persona (titular o beneficiario → su contrato completo).
 * Gate: staff + PERSON.INFO.SEGUIMIENTO.
 */
export const GET = handlerWithStaffAuth(async (_req, { params }, session) => {
  await requirePermission(session, PersonPermission.SEGUIMIENTO);
  return successResponse(await seguimientoContrato(params.id));
});
