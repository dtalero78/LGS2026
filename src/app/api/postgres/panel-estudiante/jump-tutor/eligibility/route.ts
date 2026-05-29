import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { checkJumpEligibility } from '@/services/jump-tutor.service';

// GET — whether the logged-in student can take the Jump exam right now.
export const GET = handlerWithAuth(async (_request, _context, session) => {
  const student = await resolveStudentFromSession(session);
  const eligibility = await checkJumpEligibility(student);
  return successResponse({ eligibility });
});
