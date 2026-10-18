import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { bookEssService } from '@/services/book-ess.service';

/**
 * GET /api/postgres/panel-estudiante/book-ess
 * Book ESS New: estructura del libro, actividades SIN clave y avance del alumno.
 * Solo ESTUDIANTE activo ESS · Step 0 con el interruptor encendido (o vista previa admin).
 */
export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  const res = successResponse({ data: await bookEssService.libro(session) });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
