import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { libroV2Service } from '@/services/libro-v2.service';

/** POST { pageId } — página vista ≥5 s (deduplicada por alumno/página). */
export const POST = handlerWithAuth(async (req, ctx, session) => {
  const body = await req.json().catch(() => ({}));
  return successResponse(await libroV2Service.registrarVista(ctx.params.slug, session, body?.pageId));
});
