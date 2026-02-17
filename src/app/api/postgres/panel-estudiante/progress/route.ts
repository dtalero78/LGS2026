import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentProgress } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const bookingId = student.academicaId || student._id;
  const report = await getStudentProgress(bookingId);
  return successResponse({ report });
});
