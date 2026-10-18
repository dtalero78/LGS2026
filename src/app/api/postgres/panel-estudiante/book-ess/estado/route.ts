import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { bookEssService } from '@/services/book-ess.service';

/** GET — ¿el alumno ve la opción "Book ESS New"? (interruptor + nivel + activo). Nunca 403. */
export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  const res = successResponse(await bookEssService.disponibilidad(session));
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
