import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { getEventById, updateEvent, deleteEvent } from '@/services/calendar.service';

/**
 * GET /api/postgres/events/[id]
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const event = await getEventById(params.id);
  return successResponse({ event });
});

/**
 * PUT /api/postgres/events/[id]
 */
export const PUT = handlerWithAuth(async (request, { params }) => {
  const body = await request.json();
  const event = await updateEvent(params.id, body);
  return successResponse({ event });
});

/**
 * DELETE /api/postgres/events/[id]
 */
export const DELETE = handlerWithAuth(async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const deleteBookings = searchParams.get('deleteBookings') === 'true';

  const result = await deleteEvent(params.id, deleteBookings);

  return successResponse({
    message: 'Evento eliminado exitosamente',
    eventId: params.id,
    bookingsDeleted: result.bookingsDeleted,
  });
});
