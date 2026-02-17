import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentComments } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const bookingId = student.academicaId || student._id;
  const comments = await getStudentComments(bookingId);
  return successResponse({ comments });
});
