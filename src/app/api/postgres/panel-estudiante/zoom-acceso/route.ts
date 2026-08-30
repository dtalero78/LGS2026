import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { registrarAccesoZoom } from '@/services/zoom-acceso.service';

/**
 * POST /api/postgres/panel-estudiante/zoom-acceso
 * Body: { eventoId }
 *
 * Registra que el alumno (de la sesión) generó el acceso a Zoom de esa clase.
 * Valida en el servidor que la clase sea suya y esté en plazo; devuelve hasta
 * cuándo le dura la reconexión. El alumno sale SIEMPRE de la sesión.
 */
export const POST = handlerWithAuth(async (request, _ctx, session) => {
  const student = await resolveStudentFromSession(session);
  const academicaId = (student as any).academicaId || (student as any)._id;
  const body = await request.json().catch(() => ({}));
  const ip = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent');
  const result = await registrarAccesoZoom(academicaId, { eventoId: body?.eventoId, ip, userAgent });
  return successResponse(result);
});
