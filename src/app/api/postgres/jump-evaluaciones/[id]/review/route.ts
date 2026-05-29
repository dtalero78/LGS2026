import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { reviewJumpEvaluation } from '@/services/jump-tutor.service';
import { ValidationError } from '@/lib/errors';

// POST — human decision on a bot Jump report. APROBADO creates the real Jump
// booking + triggers autoAdvanceStep; RECHAZADO just records the decision.
export const POST = handlerWithAuth(async (request, context, session) => {
  await requirePermission(session, AcademicoPermission.JUMP_EVAL_REVISAR);

  const { id } = context.params;
  const body = await request.json();
  const decision = body?.decision;
  const nota: string | null = body?.nota ?? null;

  if (decision !== 'APROBADO' && decision !== 'RECHAZADO') {
    throw new ValidationError('decision debe ser APROBADO o RECHAZADO');
  }

  const reviewedBy = (session.user as any)?.email || 'desconocido';
  const result = await reviewJumpEvaluation(id, decision, reviewedBy, nota);
  return successResponse(result);
});
