import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentUpcomingEvents } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const bookingId = student.academicaId || student._id;
  const events = await getStudentUpcomingEvents(bookingId);
  return successResponse({ events });
});
