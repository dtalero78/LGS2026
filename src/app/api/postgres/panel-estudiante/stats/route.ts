import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentStats } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const stats = await getStudentStats(student._id);
  return successResponse({ stats });
});
