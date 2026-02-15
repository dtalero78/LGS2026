import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/materials/usuario
 */
export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step');

  if (!step) throw new ValidationError('step query parameter is required');

  const materials = await queryMany(
    `SELECT "_id", "nivel", "step", "materialUsuario", "titulo", "descripcion", "orden", "_createdDate", "_updatedDate"
     FROM "NIVELES_MATERIAL"
     WHERE "step" = $1
     ORDER BY "orden" ASC`,
    [step]
  );

  if (materials.length === 0) {
    return successResponse({ material: null, message: `No material found for ${step}` });
  }

  return successResponse({ material: materials[0], allMaterials: materials, count: materials.length });
});
