import { handler, successResponse } from '@/lib/api-helpers';
import { getProfile } from '@/services/student.service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/students/[id]
 *
 * Get student full profile (ACADEMICA → PEOPLE fallback)
 */
export const GET = handler(async (request, { params }) => {
  if (!params.id) throw new ValidationError('Student ID is required');

  const data = await getProfile(params.id);

  return successResponse({ data });
});
