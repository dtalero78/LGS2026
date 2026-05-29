import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { saveJumpReport } from '@/services/jump-tutor.service';
import { ValidationError } from '@/lib/errors';

// POST — backend of the `submitJumpEvaluation` tool. The browser forwards the
// tool arguments here when the Realtime agent calls it. Saved as PENDIENTE for
// human review.
export const POST = handlerWithAuth(async (request, _context, session) => {
  const student = await resolveStudentFromSession(session);
  const body = await request.json();
  const { evaluationId, report } = body || {};

  if (!evaluationId || !report) {
    throw new ValidationError('evaluationId y report son requeridos');
  }

  const result = await saveJumpReport(evaluationId, student, report);
  return successResponse(result);
});
