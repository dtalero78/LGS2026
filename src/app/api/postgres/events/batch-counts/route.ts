import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { getBatchBookingCounts } from '@/services/calendar.service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/events/batch-counts
 *
 * Get booking counts for multiple events in a single request.
 */
export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();
  const { eventIds } = body;

  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    throw new ValidationError('eventIds array is required');
  }

  const counts = await getBatchBookingCounts(eventIds);

  return successResponse({
    counts,
    requestedEvents: eventIds.length,
    eventsWithBookings: Object.values(counts).filter((c) => c.total > 0).length,
  });
});
