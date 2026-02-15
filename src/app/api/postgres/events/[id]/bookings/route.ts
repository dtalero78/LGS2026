import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { getEventBookings } from '@/services/calendar.service';

/**
 * GET /api/postgres/events/[id]/bookings
 *
 * Get all bookings for a specific event with attendance stats.
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const includeStudent = searchParams.get('includeStudent') === 'true';

  const result = await getEventBookings(params.id, includeStudent);

  return successResponse({
    bookings: result.bookings,
    stats: result.stats,
  });
});
