import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { getEvents } from '@/services/calendar.service';
import { BookingRepository } from '@/repositories/booking.repository';

/**
 * GET /api/postgres/events/welcome
 *
 * Get WELCOME data. Two modes:
 *   - ?mode=bookings (default): Returns individual student bookings for the welcome-session page
 *   - ?mode=events: Returns calendar events with optional booking counts
 */
export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'bookings';

  if (mode === 'events') {
    const events = await getEvents({
      tipo: 'WELCOME',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      advisor: searchParams.get('advisor') || undefined,
      includeBookingCounts: searchParams.get('includeBookings') === 'true',
    });

    return successResponse({
      events,
      count: events.length,
      tipo: 'WELCOME',
    });
  }

  // Default: return individual student bookings
  const events = await BookingRepository.findWelcomeBookings(
    searchParams.get('startDate') || undefined,
    searchParams.get('endDate') || undefined,
  );

  return successResponse({
    events,
    count: events.length,
    tipo: 'WELCOME',
  });
});
