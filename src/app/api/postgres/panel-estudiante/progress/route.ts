import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentProgress } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const report = await getStudentProgress(student._id);
  return successResponse({ report });
});
