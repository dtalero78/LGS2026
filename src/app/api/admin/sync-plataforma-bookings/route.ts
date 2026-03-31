import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryOne, queryMany } from '@/lib/postgres';
import { ForbiddenError } from '@/lib/errors';

const BATCH_SIZE = 2000;

/**
 * POST /api/admin/sync-plataforma-bookings
 *
 * One-time sync: copies plataforma from ACADEMICA into ACADEMICA_BOOKINGS
 * in batches to avoid connection timeouts.
 * Only updates bookings that currently have null/empty plataforma.
 *
 * Restricted to SUPER_ADMIN only.
 */
export const POST = handlerWithAuth(async (request, context, session) => {
  const role = (session?.user as any)?.role;
  if (role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede ejecutar esta sincronización');
  }

  // 1. Preview by platform
  const preview = await queryMany(`
    SELECT a."plataforma", COUNT(*) AS bookings
    FROM "ACADEMICA_BOOKINGS" ab
    JOIN "ACADEMICA" a ON (ab."studentId" = a."_id" OR ab."idEstudiante" = a."_id")
    WHERE a."plataforma" IS NOT NULL AND a."plataforma" != ''
      AND (ab."plataforma" IS NULL OR ab."plataforma" = '')
    GROUP BY a."plataforma"
    ORDER BY bookings DESC
  `);

  const totalToUpdate = preview.reduce((sum: number, r: any) => sum + parseInt(r.bookings), 0);

  if (totalToUpdate === 0) {
    return successResponse({
      message: 'No hay bookings que actualizar — ya están sincronizados',
      updatedCount: 0,
      byPlatform: [],
    });
  }

  // 2. Update in batches
  let totalUpdated = 0;
  let batch = 0;

  while (true) {
    const result = await queryOne<{ updated: string }>(`
      WITH batch AS (
        SELECT ab."_id"
        FROM "ACADEMICA_BOOKINGS" ab
        JOIN "ACADEMICA" a ON (ab."studentId" = a."_id" OR ab."idEstudiante" = a."_id")
        WHERE a."plataforma" IS NOT NULL AND a."plataforma" != ''
          AND (ab."plataforma" IS NULL OR ab."plataforma" = '')
        LIMIT ${BATCH_SIZE}
      ),
      updated AS (
        UPDATE "ACADEMICA_BOOKINGS" ab
        SET "plataforma" = a."plataforma",
            "_updatedDate" = NOW()
        FROM "ACADEMICA" a, batch
        WHERE ab."_id" = batch."_id"
          AND (ab."studentId" = a."_id" OR ab."idEstudiante" = a."_id")
        RETURNING 1
      )
      SELECT COUNT(*) AS updated FROM updated
    `);

    const batchCount = parseInt((result as any)?.updated ?? '0');
    totalUpdated += batchCount;
    batch++;

    if (batchCount < BATCH_SIZE) break;
  }

  return successResponse({
    message: `Sincronización completada: ${totalUpdated} bookings actualizados en ${batch} lote(s)`,
    updatedCount: totalUpdated,
    batches: batch,
    byPlatform: preview,
  });
});
