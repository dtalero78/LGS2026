import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { LibrosInteractivosService } from '@/services/libros-interactivos.service';
import { EjerciciosInteractivosService } from '@/services/ejercicios-interactivos.service';
import { NotFoundError } from '@/lib/errors';

/**
 * GET /api/postgres/panel-estudiante/ejercicios-interactivos
 *
 * Ejercicios de práctica (Fase 2) para el step ACTUAL del estudiante. Genera con
 * IA + cachea la primera vez. Devuelve las preguntas SIN la respuesta correcta.
 * Si el flag está OFF o el step no tiene contenido → available:false.
 */
export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  const active = await LibrosInteractivosService.isEjerciciosActive();
  if (!active) return successResponse({ available: false, featureActive: false });

  const student = await resolveStudentFromSession(session);
  const nivel = (student.nivel || '').toUpperCase().trim();
  const step = (student.step || '').trim();
  if (!nivel || !step) return successResponse({ available: false, featureActive: true });

  const studentId = (student as any).academicaId || (student as any)._id || (student as any).numeroId;
  const progreso = await EjerciciosInteractivosService.getProgreso(studentId, nivel);

  // Cupo: 1 solo intento por step. Si ya lo completó → estado bloqueado (sin preguntas).
  const estado = await EjerciciosInteractivosService.getEstadoStep(studentId, nivel, step);
  if (estado.yaCompletado) {
    return successResponse({
      available: true, featureActive: true, nivel, step,
      yaCompletado: true, porcentaje: estado.porcentaje, aprobado: estado.aprobado,
      progreso,
    });
  }

  try {
    const data = await EjerciciosInteractivosService.getForStep(nivel, step);
    return successResponse({ available: true, featureActive: true, yaCompletado: false, progreso, ...data });
  } catch (err: any) {
    if (err instanceof NotFoundError) {
      return successResponse({ available: false, featureActive: true, nivel, step, progreso });
    }
    throw err;
  }
});
