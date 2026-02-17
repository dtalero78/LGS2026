import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentStats } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const bookingId = student.academicaId || student._id;
  const stats = await getStudentStats(bookingId);
  return successResponse({ stats });
});
