import { handler, successResponse } from '@/lib/api-helpers';
import { unifiedSearch } from '@/services/search.service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/search
 *
 * Unified search across PEOPLE and ACADEMICA tables
 */
export const GET = handler(async (request) => {
  const { searchParams } = new URL(request.url);
  const searchTerm = searchParams.get('searchTerm') || searchParams.get('q');

  if (!searchTerm || searchTerm.trim().length < 2) {
    throw new ValidationError('Search term must be at least 2 characters');
  }

  const result = await unifiedSearch(searchTerm);

  return successResponse({
    data: {
      people: result.people,
      academica: result.academica,
    },
    totalCount: result.totalCount,
  });
});
