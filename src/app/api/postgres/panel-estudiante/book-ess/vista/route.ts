import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { bookEssService } from '@/services/book-ess.service';

/** POST { pageId } — página vista ≥5 s (deduplicada por alumno/página). */
export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}));
  return successResponse(await bookEssService.registrarVista(session, body?.pageId));
});
