import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { libroV2Service } from '@/services/libro-v2.service';

/** GET [?download=1] — URL firmada (10 min) del PDF revisado. */
export const GET = handlerWithAuth(async (req, ctx, session) => {
  const descargar = new URL(req.url).searchParams.get('download') === '1';
  const res = successResponse(await libroV2Service.urlPdf(ctx.params.slug, session, descargar));
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
