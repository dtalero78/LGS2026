import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { bookEssService } from '@/services/book-ess.service';

/** POST { activityId, texto } — guarda una respuesta escrita (revisión docente). */
export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}));
  return successResponse(await bookEssService.guardarRespuesta(session, body));
});
