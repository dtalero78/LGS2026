/**
 * POST /api/admin/sync-steps
 *
 * Synchronize PEOPLE.nivel/step from ACADEMICA for all desynchronized records.
 * ACADEMICA is the source of truth for academic data.
 * Restricted to SUPER_ADMIN/ADMIN.
 */

import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError } from '@/lib/errors';
import { query } from '@/lib/postgres';

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any)?.role;
  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'admin') {
    throw new ForbiddenError('Solo SUPER_ADMIN/ADMIN pueden ejecutar esta acción.');
  }

  // Find and fix all PEOPLE records where nivel/step differs from ACADEMICA
  const result = await query(
    `UPDATE "PEOPLE" p
     SET "nivel" = a."nivel",
         "step" = a."step",
         "nivelParalelo" = COALESCE(a."nivelParalelo", p."nivelParalelo"),
         "stepParalelo" = COALESCE(a."stepParalelo", p."stepParalelo"),
         "_updatedDate" = NOW()
     FROM "ACADEMICA" a
     WHERE p."numeroId" = a."numeroId"
       AND p."tipoUsuario" = 'BENEFICIARIO'
       AND a."nivel" IS NOT NULL
       AND (
         p."nivel" IS DISTINCT FROM a."nivel"
         OR p."step" IS DISTINCT FROM a."step"
         OR (a."nivelParalelo" IS NOT NULL AND p."nivelParalelo" IS DISTINCT FROM a."nivelParalelo")
         OR (a."stepParalelo" IS NOT NULL AND p."stepParalelo" IS DISTINCT FROM a."stepParalelo")
       )
     RETURNING p."_id", p."numeroId", p."primerNombre", p."primerApellido",
               p."nivel" AS "newNivel", p."step" AS "newStep"`,
    []
  );

  console.log(`🔄 [Sync Steps] ${result.rowCount} PEOPLE records synchronized from ACADEMICA by ${session.user?.email}`);

  return successResponse({
    message: `${result.rowCount} registros sincronizados`,
    count: result.rowCount,
    updated: result.rows.slice(0, 20), // Show first 20 for verification
  });
});

// GET to preview what would be changed (dry run)
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any)?.role;
  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'admin') {
    throw new ForbiddenError('Solo SUPER_ADMIN/ADMIN pueden ejecutar esta acción.');
  }

  const result = await query(
    `SELECT p."_id", p."numeroId", p."primerNombre", p."primerApellido",
            p."nivel" AS "peopleNivel", p."step" AS "peopleStep",
            a."nivel" AS "academicaNivel", a."step" AS "academicaStep"
     FROM "PEOPLE" p
     JOIN "ACADEMICA" a ON p."numeroId" = a."numeroId"
     WHERE p."tipoUsuario" = 'BENEFICIARIO'
       AND a."nivel" IS NOT NULL
       AND (
         p."nivel" IS DISTINCT FROM a."nivel"
         OR p."step" IS DISTINCT FROM a."step"
       )
     ORDER BY p."primerApellido"
     LIMIT 100`,
    []
  );

  return successResponse({
    message: `${result.rowCount} registros desincronizados encontrados`,
    count: result.rowCount,
    records: result.rows,
  });
});
