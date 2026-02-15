import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { BookingRepository } from '@/repositories/booking.repository';
import { CalendarioRepository } from '@/repositories/calendar.repository';
import { NotFoundError, ValidationError } from '@/lib/errors';

const ALLOWED_BOOKING_FIELDS = [
  'asistio', 'asistencia', 'participacion', 'evaluacion',
  'comentarios', 'noAprobo', 'cancelo', 'comentarioAdvisor', 'comentarioEstudiante',
];

/**
 * GET /api/postgres/academic/[id]
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const booking = await BookingRepository.findById(params.id);
  if (!booking) throw new NotFoundError('Class record', params.id);
  return successResponse({ booking });
});

/**
 * PUT /api/postgres/academic/[id]
 */
export const PUT = handlerWithAuth(async (request, { params }) => {
  const body = await request.json();
  const booking = await BookingRepository.updateFields(params.id, body, ALLOWED_BOOKING_FIELDS);
  if (!booking) throw new NotFoundError('Class record', params.id);
  return successResponse({ booking, message: 'Class record updated successfully' });
});

/**
 * DELETE /api/postgres/academic/[id]
 */
export const DELETE = handlerWithAuth(async (request, { params }) => {
  const booking = await BookingRepository.findById(params.id);
  if (!booking) throw new NotFoundError('Class record', params.id);

  const eventoId = booking.eventoId || booking.idEvento;

  await BookingRepository.deleteById(params.id);

  if (eventoId) {
    await CalendarioRepository.decrementInscritos(eventoId);
  }

  return successResponse({
    message: 'Class record deleted successfully',
    deletedId: params.id,
  });
});
