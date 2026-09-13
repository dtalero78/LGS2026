import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { setEstadoInscripcion } from '@/services/exam-ciclo.service';

/**
 * POST /api/postgres/servicio/exam-agrupacion/estado
 * Body: { eventoId, studentId, estado: 'CONFIRMADO' | 'PENDIENTE' | 'CANCELADO' }
 *
 * Marca el estado de una inscripción de examen. CANCELADO libera el cupo
 * (soft-cancel); volver a CONFIRMADO/PENDIENTE re-inscribe si hace falta.
 */
export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_AGRUPACION_AGENDAR);
  const body = await req.json();
  const result = await setEstadoInscripcion({
    eventoId: String(body?.eventoId || ''),
    studentId: String(body?.studentId || ''),
    estado: String(body?.estado || ''),
    agendadoPor: session?.user?.name || undefined,
    agendadoPorEmail: session?.user?.email || undefined,
    agendadoPorRol: (session?.user as any)?.role || undefined,
    sessionRole: (session?.user as any)?.role || undefined,
  });
  return successResponse({ ...result, message: `Inscripción marcada como ${result.estado}.` });
});
