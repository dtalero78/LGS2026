import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { agendarSerieCurso } from '@/services/exam-ciclo.service';

/**
 * POST /api/postgres/servicio/exam-agrupacion/agendar
 * Body: { cicloId, examen ('IELTS'|'TOEFL'|'B2FIRST'), studentIds: string[] }
 *
 * Agendamiento masivo a un CURSO: inscribe a los estudiantes seleccionados en
 * TODA la serie de eventos de ese examen dentro del ciclo (todas las franjas y
 * fechas). Excluye, evento por evento, a los que ya estén inscritos.
 */
export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_AGRUPACION_AGENDAR);
  const body = await req.json();
  const result = await agendarSerieCurso({
    cicloId: String(body?.cicloId || ''),
    examen: String(body?.examen || ''),
    studentIds: Array.isArray(body?.studentIds) ? body.studentIds : [],
    agendadoPor: session?.user?.name || undefined,
    agendadoPorEmail: session?.user?.email || undefined,
    agendadoPorRol: (session?.user as any)?.role || undefined,
    sessionRole: (session?.user as any)?.role || undefined,
  });
  return successResponse({
    ...result,
    message: `${result.enrolled} inscripción(es) en ${result.eventos} sesión(es) del curso.`,
  });
});
