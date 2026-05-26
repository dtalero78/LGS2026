import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { UnauthorizedError } from '@/lib/errors';
import { updateAdvisorNotes } from '@/services/advisor-event-log.service';

/**
 * PATCH /api/postgres/calendario/[eventoId]/notas-advisor
 *
 * Body: { timeout?, notasadvisor? }
 *
 * El advisor asignado al evento edita SUS notas (Ctrl Horas / sesión).
 * El service valida: email matchea ADVISORS, formato HH:MM militar,
 * timeout > horaInicio, ventana temporal (+30 min) y sesión no cerrada.
 */
export const PATCH = handlerWithAuth(async (request, { params }, session) => {
  const email = (session?.user as any)?.email;
  if (!email) throw new UnauthorizedError('Sesión sin email');

  const body = await request.json().catch(() => ({}));
  // sessionRole se toma de la sesión NextAuth (no del body, no spoofeable).
  // Sólo SUPER_ADMIN/ADMIN bypasean ownership / ventana temporal / sesión cerrada.
  const sessionRole = (session?.user as any)?.role;
  const result = await updateAdvisorNotes(params.eventoId, email, {
    timeout:         body?.timeout,
    notasadvisor:    body?.notasadvisor,
    tz:              typeof body?.tz === 'string' ? body.tz : undefined,
    sessionRole,
    motivoAdminEdit: typeof body?.motivoAdminEdit === 'string' ? body.motivoAdminEdit : undefined,
  });
  return successResponse(result);
});
