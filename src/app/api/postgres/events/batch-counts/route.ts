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

  // Build flat maps for frontend compatibility
  const inscritosCounts: Record<string, number> = {};
  const asistenciasCounts: Record<string, number> = {};
  for (const [id, c] of Object.entries(counts)) {
    inscritosCounts[id] = c.total;
    asistenciasCounts[id] = c.asistencias;
  }

  return successResponse({
    counts,
    inscritosCounts,
    asistenciasCounts,
    requestedEvents: eventIds.length,
    eventsWithBookings: Object.values(counts).filter((c) => c.total > 0).length,
  });
});
