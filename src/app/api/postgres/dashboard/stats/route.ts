import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { getStats } from '@/services/dashboard.service';

/**
 * GET /api/postgres/dashboard/stats
 *
 * Get dashboard statistics (users, events, enrollments, top students).
 */
export const GET = handlerWithAuth(async () => {
  const stats = await getStats();
  return successResponse({ stats });
});
