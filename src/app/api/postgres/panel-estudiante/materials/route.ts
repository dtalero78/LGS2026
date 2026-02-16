import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession, getStudentMaterials } from '@/services/panel-estudiante.service';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);
  const nivel = student.nivel || '';
  const materials = await getStudentMaterials(nivel);
  return successResponse({ materials, nivel });
});
