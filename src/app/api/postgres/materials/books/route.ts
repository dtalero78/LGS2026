import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/materials/books
 * Returns all unique materialUsuario PDFs from NIVELES table (books available for download).
 */
export const GET = handlerWithAuth(async () => {
  const rows = await queryMany(
    `SELECT "code", "step", "materialUsuario"
     FROM "NIVELES"
     WHERE "materialUsuario" IS NOT NULL
     ORDER BY "code" ASC, "step" ASC`
  );

  const seen = new Set<string>();
  const books: { name: string; url: string; nivel: string; step: string }[] = [];

  for (const row of rows) {
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
          });
        }
      }
    }
  }

  return successResponse({ books });
});
