import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { libroV2Service } from '@/services/libro-v2.service';

/** GET ?id=<pageId> — URL firmada (10 min) de una página del libro. Solo IDs del paquete. */
export const GET = handlerWithAuth(async (req, ctx, session) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  const res = successResponse(await libroV2Service.urlPagina(ctx.params.slug, session, id));
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
