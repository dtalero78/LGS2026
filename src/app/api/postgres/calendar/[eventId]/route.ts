import { handler, successResponse } from '@/lib/api-helpers';
import { BookingRepository } from '@/repositories/booking.repository';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/calendar/[eventId]
 *
 * Get bookings/enrollments for a calendar event with student details.
 */
export const GET = handler(async (request, { params }) => {
  if (!params.eventId) throw new ValidationError('Event ID is required');

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '500');

  const bookings = await BookingRepository.findByEventIdWithStudents(params.eventId, limit);

  return successResponse({
    data: bookings,
    total: bookings.length,
    eventId: params.eventId,
  });
});
