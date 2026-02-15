import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { getEvents } from '@/services/calendar.service';

/**
 * GET /api/postgres/events/sessions
 *
 * Get all SESSION-type events with optional filters.
 */
export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);

  const events = await getEvents({
    tipo: 'SESSION',
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    advisor: searchParams.get('advisor') || undefined,
    nivel: searchParams.get('nivel') || undefined,
    includeBookingCounts: searchParams.get('includeBookings') === 'true',
  });

  return successResponse({
    events,
    count: events.length,
    tipo: 'SESSION',
  });
});
