import { handler, successResponse } from '@/lib/api-helpers';
import { getEvents } from '@/services/calendar.service';

/**
 * GET /api/postgres/calendar/events
 *
 * Get calendar events with optional filters (month, date range, tipo, advisor, nivel).
 */
export const GET = handler(async (request) => {
  const { searchParams } = new URL(request.url);

  const month = searchParams.get('month');
  const tipo = searchParams.get('tipo');
  const advisor = searchParams.get('advisor');
  const nivel = searchParams.get('nivel');
  const limit = parseInt(searchParams.get('limit') || '500');

  let startDate = searchParams.get('startDate');
  let endDate = searchParams.get('endDate');

  // Convert month (YYYY-MM) to date range
  if (month && !startDate && !endDate) {
    const [year, monthNum] = month.split('-');
    startDate = `${year}-${monthNum}-01T00:00:00.000Z`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    endDate = `${year}-${monthNum}-${lastDay.toString().padStart(2, '0')}T23:59:59.999Z`;
  } else if (startDate && endDate) {
    startDate = `${startDate}T00:00:00.000Z`;
    endDate = `${endDate}T23:59:59.999Z`;
  }

  const events = await getEvents({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    tipo: tipo || undefined,
    advisor: advisor || undefined,
    nivel: nivel || undefined,
    limit,
  });

  return successResponse({
    data: events,
    total: events.length,
    filters: { month, startDate, endDate, tipo, advisor, nivel },
  });
});
