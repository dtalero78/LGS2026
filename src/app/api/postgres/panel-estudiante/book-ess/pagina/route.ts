import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { bookEssService } from '@/services/book-ess.service';

/** GET ?id=ST00-00-p001 — URL firmada (10 min) de una página del manifiesto. */
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  const res = successResponse(await bookEssService.urlPagina(session, id));
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
