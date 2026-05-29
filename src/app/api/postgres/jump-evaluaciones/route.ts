import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { listJumpEvaluations } from '@/services/jump-tutor.service';

// GET — admin/advisor list of bot Jump reports for review.
export const GET = handlerWithAuth(async (request, _context, session) => {
  await requirePermission(session, AcademicoPermission.JUMP_EVAL_REVISAR);

  const url = new URL(request.url);
  const reviewStatus = url.searchParams.get('reviewStatus') || undefined;
  const nivel = url.searchParams.get('nivel') || undefined;

  const evaluaciones = await listJumpEvaluations({ reviewStatus, nivel });
  return successResponse({ evaluaciones });
});
