import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { generarEventos } from '@/services/exam-ciclo.service';

/**
 * POST /api/postgres/servicio/exam-ciclo/[id]/generar
 *
 * Genera en CALENDARIO todos los eventos de examen del ciclo (según las franjas
 * de días+hora por examen) para el rango de fechas del ciclo. Idempotente: un
 * ciclo ya GENERADO responde 409 sin duplicar.
 */
export const POST = handlerWithAuth(async (_req: NextRequest, { params }, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_GENERAR);
  const result = await generarEventos(params.id);
  return successResponse({ ...result, message: `${result.generados} evento(s) generado(s).` });
});
