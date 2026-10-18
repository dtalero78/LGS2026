import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { bookEssService } from '@/services/book-ess.service';

/** GET [?download=1] — URL firmada (10 min) del PDF corregido (sin claves). */
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  const descargar = new URL(req.url).searchParams.get('download') === '1';
  const res = successResponse(await bookEssService.urlPdf(session, descargar));
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
