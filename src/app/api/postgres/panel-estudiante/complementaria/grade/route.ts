import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { gradeAnswers } from '@/services/complementaria.service';
import { ValidationError } from '@/lib/errors';

export const POST = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const body = await request.json();
  const { attemptId, answers } = body;
  if (!attemptId) throw new ValidationError('attemptId es requerido');
  if (!answers || !Array.isArray(answers) || answers.length !== 10) {
    throw new ValidationError('Debes enviar exactamente 10 respuestas');
  }

  const studentId = student.academicaId || student._id;
  const result = await gradeAnswers(attemptId, studentId, answers);
  return successResponse(result);
});
