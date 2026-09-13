import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { listEventosCiclo } from '@/services/exam-ciclo.service';

/**
 * GET /api/postgres/servicio/exam-agrupacion/eventos?cicloId=
 *
 * Lista los eventos de examen generados por un ciclo (para el dropdown de
 * "agendar a este evento" de la pestaña Agrupación).
 */
export const GET = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_VER);
  const { searchParams } = new URL(req.url);
  const cicloId = (searchParams.get('cicloId') || '').trim();
  if (!cicloId) throw new ValidationError('cicloId es requerido');
  const eventos = await listEventosCiclo(cicloId);
  return successResponse({ eventos });
});
