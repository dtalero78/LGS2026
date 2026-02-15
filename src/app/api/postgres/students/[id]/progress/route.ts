import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { generateReport } from '@/services/progress.service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/students/[id]/progress
 *
 * Get student progress report ("¿Cómo voy?")
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  if (!params.id) throw new ValidationError('Student ID is required');

  const report = await generateReport(params.id);
  return successResponse(report);
});
