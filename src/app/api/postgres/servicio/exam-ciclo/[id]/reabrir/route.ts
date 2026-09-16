import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { reabrirCiclo } from '@/services/exam-ciclo.service';

/**
 * POST /api/postgres/servicio/exam-ciclo/[id]/reabrir
 *
 * Reabre un ciclo GENERADO para editarlo: borra sus eventos del calendario y lo
 * deja en BORRADOR. Bloquea (409) si tiene inscritos activos.
 */
export const POST = handlerWithAuth(async (_req: NextRequest, { params }, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_GENERAR);
  const ciclo = await reabrirCiclo(params.id);
  return successResponse({ ciclo, message: 'Ciclo reabierto para edición.' });
});
