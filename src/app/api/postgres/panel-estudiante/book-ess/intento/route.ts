import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { bookEssService } from '@/services/book-ess.service';

/**
 * POST { assessmentId, requestId, contentVersion, answers: [{ activityId, optionId }] }
 * Calificación en el servidor; la nota, el aprobado y la identidad nunca vienen del cliente.
 */
export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}));
  return successResponse({ data: await bookEssService.calificar(session, body) });
});
