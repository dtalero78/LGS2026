import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { listCursosCiclo } from '@/services/exam-ciclo.service';

/**
 * GET /api/postgres/servicio/exam-agrupacion/cursos?cicloId=
 *
 * Lista los "cursos" del ciclo = un grupo por examen (IELTS/TOEFL/B2FIRST) con
 * su advisor, nº de sesiones, franjas e inscritos. Agendar a un curso inscribe
 * en TODA su serie de eventos.
 */
export const GET = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_VER);
  const { searchParams } = new URL(req.url);
  const cicloId = (searchParams.get('cicloId') || '').trim();
  if (!cicloId) throw new ValidationError('cicloId es requerido');
  const cursos = await listCursosCiclo(cicloId);
  return successResponse({ cursos });
});
