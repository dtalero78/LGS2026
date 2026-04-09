import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { generateQuestions } from '@/services/complementaria.service';
import { ValidationError } from '@/lib/errors';

export const POST = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const body = await request.json();
  const { step } = body;
  if (!step) throw new ValidationError('step es requerido');

  const studentId = student.academicaId || student._id;
  const result = await generateQuestions(studentId, student.nivel, step, student.plataforma);
  return successResponse(result);
});
