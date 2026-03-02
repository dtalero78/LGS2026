import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { ComplementariaRepository } from '@/repositories/complementaria.repository';
import { ValidationError } from '@/lib/errors';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const url = new URL(request.url);
  const step = url.searchParams.get('step');
  if (!step) throw new ValidationError('step es requerido');

  const studentId = student.academicaId || student._id;
  const attempts = await ComplementariaRepository.findByStudentAndStep(
    studentId, student.nivel, step
  );
  return successResponse({ attempts, total: attempts.length });
});
