import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentProfile } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const profile = await getStudentProfile(student._id);
  return successResponse({ profile });
});
