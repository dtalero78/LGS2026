import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

/**
 * GET /api/postgres/materials/nivel
 */
export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step');

  if (!step) throw new ValidationError('step query parameter is required');

  // Normalize step format ("Step1" -> "Step 1")
  let normalizedStep = step;
  if (!step.includes(' ')) {
    normalizedStep = step.replace(/^Step(\d+)$/, 'Step $1');
  }

  const nivel = await queryOne(
    `SELECT "_id", "code", "step", "material", "description", "clubs", "steps", "esParalelo", "_createdDate", "_updatedDate"
     FROM "NIVELES"
     WHERE "step" = $1 OR "step" = $2
     LIMIT 1`,
    [step, normalizedStep]
  );

  if (!nivel) {
    return successResponse({ material: null, message: `No material found for ${step}` });
  }

  return successResponse({
    nivel: nivel.code, step: nivel.step, material: nivel.material,
    description: nivel.description, clubs: nivel.clubs, esParalelo: nivel.esParalelo,
  });
});
