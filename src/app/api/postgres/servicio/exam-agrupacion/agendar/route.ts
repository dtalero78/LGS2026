import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { agendarMasivo } from '@/services/exam-ciclo.service';

/**
 * POST /api/postgres/servicio/exam-agrupacion/agendar
 * Body: { eventoId, studentIds: string[] (ACADEMICA._id) }
 *
 * Agendamiento masivo: inscribe a los estudiantes seleccionados en el evento de
 * examen. Excluye los que ya están inscritos ACTIVOS (no aborta el lote).
 */
export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_AGRUPACION_AGENDAR);
  const body = await req.json();
  const result = await agendarMasivo({
    eventoId: String(body?.eventoId || ''),
    studentIds: Array.isArray(body?.studentIds) ? body.studentIds : [],
    agendadoPor: session?.user?.name || undefined,
    agendadoPorEmail: session?.user?.email || undefined,
    agendadoPorRol: (session?.user as any)?.role || undefined,
    sessionRole: (session?.user as any)?.role || undefined,
  });
  const extra = result.yaInscritos > 0 ? ` (${result.yaInscritos} ya estaban inscritos)` : '';
  return successResponse({
    ...result,
    message: `${result.enrolled} estudiante(s) agendado(s)${extra}.`,
  });
});
