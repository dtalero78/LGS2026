import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { BookingRepository } from '@/repositories/booking.repository';

/**
 * GET /api/postgres/events/sessions
 *
 * Get all SESSION/CLUB bookings with student names resolved from ACADEMICA/PEOPLE.
 */
export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  const events = await BookingRepository.findSessionBookings(startDate, endDate);

  return successResponse({
    events,
    count: events.length,
  });
});
