import { handler, successResponse } from '@/lib/api-helpers';
import { NivelesRepository } from '@/repositories/niveles.repository';

/**
 * GET /api/postgres/niveles
 *
 * Returns levels grouped by code with steps and clubs arrays.
 * Each row in NIVELES is one step of one level, so we group them.
 */
export const GET = handler(async () => {
  const rows = await NivelesRepository.findAll();

  // Group rows by code to build a single object per level
  const byCode = new Map<string, any>();
  for (const row of rows) {
    if (!byCode.has(row.code)) {
      byCode.set(row.code, {
        code: row.code,
        esParalelo: row.esParalelo,
        orden: row.orden,
        steps: [],
        clubs: [],
      });
    }
    const nivel = byCode.get(row.code)!;

    // Collect unique step names
    if (row.step && !nivel.steps.includes(row.step)) {
      nivel.steps.push(row.step);
    }

    // Collect unique clubs from each row's clubs JSONB array
    if (Array.isArray(row.clubs)) {
      for (const club of row.clubs) {
        if (!nivel.clubs.includes(club)) {
          nivel.clubs.push(club);
        }
      }
    }
  }

  const niveles = Array.from(byCode.values());

  // Sort steps numerically within each level
  for (const nivel of niveles) {
    nivel.steps.sort((a: string, b: string) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }

  return successResponse({ niveles, data: niveles, total: niveles.length });
});
