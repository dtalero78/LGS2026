import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { libroV2Service } from '@/services/libro-v2.service';

/** POST { activityId, texto } — guarda una respuesta abierta (revisión docente). */
export const POST = handlerWithAuth(async (req, ctx, session) => {
  const body = await req.json().catch(() => ({}));
  return successResponse(await libroV2Service.guardarRespuesta(ctx.params.slug, session, body));
});
