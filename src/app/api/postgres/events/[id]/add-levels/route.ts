import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { addLevelsToEvent } from '@/services/calendar.service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/events/[id]/add-levels
 * Body: { niveles: Array<{ nivel, step, nombreEvento? }> }
 *
 * Agrega niveles a un evento existente convirtiéndolo en compartido (o ampliando
 * el grupo). Restricciones (validadas en el service): evento futuro, no cerrado,
 * tipo compartible, total ≤ 4 niveles, niveles distintos, mismo club para CLUB.
 */
export const POST = handlerWithAuth(async (req, { params }) => {
  const body = await req.json().catch(() => ({}));
  const niveles = Array.isArray(body?.niveles) ? body.niveles : null;
  if (!niveles || niveles.length === 0) {
    throw new ValidationError('Debes indicar al menos un nivel con su step.');
  }
  const result = await addLevelsToEvent(params.id, niveles);
  return successResponse(result);
});
