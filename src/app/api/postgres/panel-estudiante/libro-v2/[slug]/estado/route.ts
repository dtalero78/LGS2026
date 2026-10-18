import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { libroV2Service } from '@/services/libro-v2.service';

/** GET — ¿el alumno ve la opción de este libro? (interruptor + etapa + activo). Nunca 403. */
export const GET = handlerWithAuth(async (_req, ctx, session) => {
  const res = successResponse(await libroV2Service.disponibilidad(ctx.params.slug, session));
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
