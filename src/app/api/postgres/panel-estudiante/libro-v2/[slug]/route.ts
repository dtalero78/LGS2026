import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { libroV2Service } from '@/services/libro-v2.service';

/**
 * GET /api/postgres/panel-estudiante/libro-v2/[slug]   (slug: beg | pra | func)
 * New Books v2: estructura del libro, actividades SIN clave y avance del alumno.
 * Solo ESTUDIANTE activo de la etapa del libro con su interruptor encendido (o vista previa admin).
 */
export const GET = handlerWithAuth(async (_req, ctx, session) => {
  const res = successResponse({ data: await libroV2Service.libro(ctx.params.slug, session) });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
