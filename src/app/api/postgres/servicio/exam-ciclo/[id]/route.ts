import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { deleteCiclo } from '@/services/exam-ciclo.service';

/**
 * DELETE /api/postgres/servicio/exam-ciclo/[id]
 *
 * Borra un ciclo y TODOS sus eventos generados (y bookings). Bloquea (409) si
 * el ciclo tiene inscritos activos — deben cancelarse en Agrupación primero.
 */
export const DELETE = handlerWithAuth(async (_req: NextRequest, { params }, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_GENERAR);
  const r = await deleteCiclo(params.id);
  return successResponse({ ...r, message: `Ciclo borrado (${r.eventosBorrados} evento(s) eliminados).` });
});
