import { handler, successResponse } from '@/lib/api-helpers';
import { AdvisorRepository } from '@/repositories/advisor.repository';

/**
 * GET /api/postgres/advisors
 *
 * If ?advisorId= is provided, returns a single advisor lookup.
 * Otherwise returns the full list.
 */
export const GET = handler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const advisorId = searchParams.get('advisorId');

  if (advisorId) {
    const advisor = await AdvisorRepository.findByIdOrEmail(advisorId);
    return successResponse({ advisor });
  }

  const includeInactive = searchParams.get('includeInactive') === 'true';
  const advisors = await AdvisorRepository.findAll(includeInactive);

  return successResponse({ advisors, data: advisors, total: advisors.length });
});

/**
 * POST /api/postgres/advisors (frontend compatibility)
 */
export const POST = handler(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const includeInactive = body.includeInactive === true;
  const advisors = await AdvisorRepository.findAll(includeInactive);

  return successResponse({ advisors, data: advisors, total: advisors.length });
});
