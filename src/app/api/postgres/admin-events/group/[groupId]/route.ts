/**
 * DELETE /api/postgres/admin-events/group/[groupId]
 *   Elimina TODO el grupo (todas las filas con el mismo eventGroupId).
 *
 * POST   /api/postgres/admin-events/group/[groupId]  (body: { advisorIds })
 *   Agrega advisors a un evento ya creado (copia tipo/fecha/horas del grupo).
 *   Útil para MEETINGs donde se suma gente sobre la hora.
 *
 * Ambos gateados por ADMIN_EVENTS.GESTIONAR.
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { deleteAdminEventGroup, addAdvisorsToGroup } from '@/services/admin-events.service';

export const DELETE = handlerWithAuth(async (_request, { params }, session) => {
  await requirePermission(session, AcademicoPermission.ADMIN_EVENTS_GESTIONAR);
  const n = await deleteAdminEventGroup(params.groupId);
  if (n === 0) throw new NotFoundError('Admin Event Group', params.groupId);
  return successResponse({ deleted: n });
});

export const POST = handlerWithAuth(async (request, { params }, session) => {
  await requirePermission(session, AcademicoPermission.ADMIN_EVENTS_GESTIONAR);
  const body = await request.json();
  const advisorIds: string[] = Array.isArray(body?.advisorIds) ? body.advisorIds : [];
  if (advisorIds.length === 0) throw new ValidationError('advisorIds requerido (array no vacío)');
  const createdBy = (session?.user as any)?.email ?? null;
  const result = await addAdvisorsToGroup({ eventGroupId: params.groupId, advisorIds, createdBy });
  return successResponse(result);
});
