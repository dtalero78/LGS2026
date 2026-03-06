import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

/**
 * GET /api/postgres/materials/nivel?step=Step 7
 * Returns material and materialUsuario for a given step from NIVELES table.
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
    `SELECT "_id", "code", "step", "material", "materialUsuario", "description", "clubs", "steps", "esParalelo", "_createdDate", "_updatedDate"
     FROM "NIVELES"
     WHERE "step" = $1 OR "step" = $2
     LIMIT 1`,
    [step, normalizedStep]
  );

  if (!nivel) {
    return successResponse({ materials: [], material: null, message: `No material found for ${step}` });
  }

  // Parse material JSONB (legacy format: [{name, url}, ...])
  let parsedMaterial = nivel.material;
  if (typeof parsedMaterial === 'string') {
    try { parsedMaterial = JSON.parse(parsedMaterial); } catch { parsedMaterial = []; }
  }

  // Build unified materials array from both sources
  const materials: { index: number; name: string; url: string }[] = [];
  const seen = new Set<string>();

  // 1. materialUsuario: DO Spaces keys like "materials/Filename.pdf"
  const userMats = nivel.materialUsuario || [];
  if (Array.isArray(userMats)) {
    for (const key of userMats) {
      if (typeof key === 'string' && key.startsWith('materials/') && !seen.has(key)) {
        seen.add(key);
        const filename = decodeURIComponent(key.split('/').pop() || key);
        materials.push({
          index: materials.length + 1,
          name: filename.replace(/\.pdf$/i, ''),
          url: `/api/postgres/niveles/material?key=${encodeURIComponent(key)}`,
        });
      }
    }
  }

  // 2. material: legacy JSONB [{name, url}, ...]
  if (Array.isArray(parsedMaterial)) {
    for (const m of parsedMaterial) {
      if (m && m.url && !seen.has(m.url)) {
        seen.add(m.url);
        materials.push({
          index: materials.length + 1,
          name: m.name || m.nombre || `Material ${materials.length + 1}`,
          url: m.url,
        });
      }
    }
  }

  return successResponse({
    materials,
    nivel: nivel.code, step: nivel.step, material: nivel.material,
    description: nivel.description, clubs: nivel.clubs, esParalelo: nivel.esParalelo,
  });
});
