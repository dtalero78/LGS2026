/**
 * GET /api/postgres/events/[id]/group
 *
 * Devuelve los eventos hermanos del grupo compartido (incluye al evento
 * solicitado). Si el evento NO es compartido, devuelve sólo ese evento.
 *
 * Usado por el modal de confirmación al eliminar — para mostrar al admin
 * los demás eventos del grupo y preguntarle si quiere borrarlos también.
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { CalendarioRepository } from '@/repositories/calendar.repository';

export const GET = handlerWithAuth(async (_req, { params }) => {
  const siblings = await CalendarioRepository.findGroupSiblings(params.id);
  return successResponse({
    eventoId: params.id,
    siblings,
    isShared: siblings.length > 1,
    grupoSize: siblings.length,
  });
});
