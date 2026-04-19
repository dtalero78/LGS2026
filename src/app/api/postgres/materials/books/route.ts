import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/materials/books
 * Returns all material from NIVELES for the advisor panel:
 * - materialUsuario (DO Spaces keys) → tipo: 'usuario'
 * - material (advisor JSONB objects, skips wix:document:// URLs) → tipo: 'advisor'
 */
export const GET = handlerWithAuth(async () => {
  const rows = await queryMany(
    `SELECT "code", "step", "materialUsuario", "material"
     FROM "NIVELES"
     WHERE "materialUsuario" IS NOT NULL OR "material" IS NOT NULL
     ORDER BY "code" ASC, "step" ASC`
  );

  const seen = new Set<string>();
  const books: { name: string; url: string; nivel: string; step: string; tipo: 'usuario' | 'advisor' }[] = [];

  for (const row of rows) {
    // materialUsuario: array of DO Spaces keys
    const userMats = row.materialUsuario || [];
    if (Array.isArray(userMats)) {
      for (const key of userMats) {
        if (typeof key === 'string' && key.startsWith('materials/') && !seen.has(key)) {
          seen.add(key);
          const filename = decodeURIComponent(key.split('/').pop() || key);
          books.push({
            name: filename.replace(/\.pdf$/i, ''),
            url: `/api/postgres/niveles/material?key=${encodeURIComponent(key)}`,
            nivel: row.code || '',
            step: row.step || '',
            tipo: 'usuario',
          });
        }
      }
    }

    // material (advisor): JSONB [{name, url}, ...] or DO Spaces keys
    let advisorMats = row.material;
    if (typeof advisorMats === 'string') {
      try { advisorMats = JSON.parse(advisorMats); } catch { advisorMats = []; }
    }
    if (Array.isArray(advisorMats)) {
      for (const m of advisorMats) {
        const url  = typeof m === 'string' ? m : (m?.url || '');
        const name = typeof m === 'string'
          ? decodeURIComponent(url.split('/').pop() || url).replace(/\.pdf$/i, '')
          : (m?.name || m?.nombre || '');
        // Skip legacy Wix URLs and empty/duplicate entries
        if (!url || url.startsWith('wix:') || seen.has(url)) continue;
        seen.add(url);
        const spacesKey = url.startsWith('materials/') ? url : undefined;
        books.push({
          name,
          url: spacesKey
            ? `/api/postgres/niveles/material?key=${encodeURIComponent(spacesKey)}`
            : url,
          nivel: row.code || '',
          step: row.step || '',
          tipo: 'advisor',
        });
      }
    }
  }

  return successResponse({ books });
});
