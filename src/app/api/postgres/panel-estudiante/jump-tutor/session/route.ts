import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { startJumpSession } from '@/services/jump-tutor.service';

// POST — mint an ephemeral Realtime client secret + the dynamic instructions
// and tool for the Jump exam. OPENAI_API_KEY never leaves the server.
export const POST = handlerWithAuth(async (_request, _context, session) => {
  const student = await resolveStudentFromSession(session);
  const result = await startJumpSession(student);
  return successResponse(result);
});
