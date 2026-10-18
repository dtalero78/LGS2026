import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { libroV2Service } from '@/services/libro-v2.service';

/**
 * POST { checkpointId, requestId, contentVersion, answers: [{ activityId, optionId }] }
 * Calificación en el servidor; la nota, el aprobado y la identidad nunca vienen del cliente.
 */
export const POST = handlerWithAuth(async (req, ctx, session) => {
  const body = await req.json().catch(() => ({}));
  return successResponse({ data: await libroV2Service.calificar(ctx.params.slug, session, body) });
});
