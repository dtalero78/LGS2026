import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { createEvent } from '@/services/calendar.service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/events
 *
 * Create a new event in the calendar.
 */
export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();

  if (!body.dia) throw new ValidationError('dia is required');
  if (!body.advisor) throw new ValidationError('advisor is required');

  const diaDate = new Date(body.dia);
  const hora = body.hora || `${diaDate.getHours().toString().padStart(2, '0')}:${diaDate.getMinutes().toString().padStart(2, '0')}`;

  let tituloONivel = body.titulo || body.nombreEvento || '';
  if (body.nivel) {
    tituloONivel = body.nivel + (body.step ? ` - ${body.step}` : '');
  }

  const event = await createEvent({
    dia: body.dia,
    hora,
    advisor: body.advisor,
    nivel: body.nivel,
    step: body.step,
    tipo: body.tipo || body.evento || 'SESSION',
    titulo: body.titulo || body.tituloONivel,
    nombreEvento: body.nombreEvento,
    tituloONivel: tituloONivel || body.tituloONivel,
    linkZoom: body.linkZoom,
    limiteUsuarios: body.limiteUsuarios || 30,
    club: body.club,
    observaciones: body.observaciones,
  });

  return successResponse({
    event,
    message: 'Evento creado exitosamente',
  });
});
