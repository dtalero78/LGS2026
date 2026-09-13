import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { listRoster } from '@/services/exam-ciclo.service';

/**
 * GET /api/postgres/servicio/exam-agrupacion/roster?eventoId=
 *
 * Lista los inscritos de un evento de examen con su estado por inscripción
 * (CONFIRMADO / PENDIENTE / CANCELADO).
 */
export const GET = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_VER);
  const { searchParams } = new URL(req.url);
  const eventoId = (searchParams.get('eventoId') || '').trim();
  if (!eventoId) throw new ValidationError('eventoId es requerido');
  const inscritos = await listRoster(eventoId);
  return successResponse({ inscritos });
});
