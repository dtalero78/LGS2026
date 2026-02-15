import { handler, successResponse } from '@/lib/api-helpers';
import { NivelesRepository } from '@/repositories/niveles.repository';

/**
 * GET /api/postgres/niveles
 */
export const GET = handler(async () => {
  const levels = await NivelesRepository.findAll();
  return successResponse({ data: levels, total: levels.length });
});
