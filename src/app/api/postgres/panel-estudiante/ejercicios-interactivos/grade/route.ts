import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { LibrosInteractivosService } from '@/services/libros-interactivos.service';
import { EjerciciosInteractivosService } from '@/services/ejercicios-interactivos.service';
import { ValidationError, ConflictError } from '@/lib/errors';

/**
 * POST /api/postgres/panel-estudiante/ejercicios-interactivos/grade
 * Body: { answers: any[] }  (answers[i] = respuesta a la pregunta i)
 *
 * Califica server-side contra el set cacheado del step actual del estudiante.
 * Solo práctica: devuelve resultado sin tocar step/bookings.
 */
export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const active = await LibrosInteractivosService.isEjerciciosActive();
  if (!active) throw new ValidationError('La práctica interactiva no está activa');

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body?.answers)) throw new ValidationError('Body debe incluir "answers" (array)');

  const student = await resolveStudentFromSession(session);
  const nivel = (student.nivel || '').toUpperCase().trim();
  const step = (student.step || '').trim();
  if (!nivel || !step) throw new ValidationError('El estudiante no tiene nivel/step asignado');

  const studentId = (student as any).academicaId || (student as any)._id || (student as any).numeroId;
  const numeroId = (student as any).numeroId ?? null;

  // Cupo: 1 solo intento por step. Si ya lo completó, no se puede volver a calificar.
  const estado = await EjerciciosInteractivosService.getEstadoStep(studentId, nivel, step);
  if (estado.yaCompletado) {
    throw new ConflictError('Ya completaste el ejercicio de este step (un solo intento por step).');
  }

  const result = await EjerciciosInteractivosService.grade(nivel, step, body.answers);

  // Registra el intento (idempotente) y calcula el progreso actualizado.
  await EjerciciosInteractivosService.registrarIntento({
    studentId, numeroId, nivel, step,
    porcentaje: result.porcentaje, aprobado: result.aprobado,
  });
  const progreso = await EjerciciosInteractivosService.getProgreso(studentId, step);

  return successResponse({ ...result, progreso });
});
