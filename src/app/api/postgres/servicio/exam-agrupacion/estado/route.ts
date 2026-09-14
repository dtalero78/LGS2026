import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { setEstadoInscripcionSerie } from '@/services/exam-ciclo.service';

/**
 * POST /api/postgres/servicio/exam-agrupacion/estado
 * Body: { cicloId, examen, studentId, estado: 'CONFIRMADO'|'PENDIENTE'|'CANCELADO' }
 *
 * Marca el estado de un estudiante en TODA la serie del curso. CANCELADO hace
 * soft-cancel de todas sus sesiones del examen (libera cupo); volver a
 * CONFIRMADO/PENDIENTE lo re-inscribe en la serie.
 */
export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_AGRUPACION_AGENDAR);
  const body = await req.json();
  const result = await setEstadoInscripcionSerie({
    cicloId: String(body?.cicloId || ''),
    examen: String(body?.examen || ''),
    studentId: String(body?.studentId || ''),
    estado: String(body?.estado || ''),
    agendadoPor: session?.user?.name || undefined,
    agendadoPorEmail: session?.user?.email || undefined,
    agendadoPorRol: (session?.user as any)?.role || undefined,
    sessionRole: (session?.user as any)?.role || undefined,
  });
  return successResponse({ ...result, message: `Curso marcado como ${result.estado}.` });
});
