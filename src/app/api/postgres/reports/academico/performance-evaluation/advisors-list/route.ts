/**
 * GET /api/postgres/reports/academico/performance-evaluation/advisors-list
 *
 * Lista de advisors que han recibido al menos 1 evaluación, para alimentar
 * el dropdown de la pestaña "Por Advisor" en el dashboard Performance Evaluation.
 *
 * Devuelve para cada advisor:
 *   { _id, nombre, activo, evaluaciones }
 *
 * Ordenado alfabéticamente por nombre. El cliente filtra por activos/inactivos
 * con un toggle (no se aplica en SQL para que el set sea reutilizable).
 *
 * Gateado por ACADEMICO.PERFORMANCE_EVAL.POR_ADVISOR (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { queryMany } from '@/lib/postgres';

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  // Base VER: lo consumen la pestaña "Por Advisor" y la pestaña "Lista".
  // Devuelve solo nombres/país/conteo (los nombres ya se ven en los rankings).
  await requirePermission(session, AcademicoPermission.PERFORMANCE_EVAL_VER);

  const rows = await queryMany<{
    _id: string;
    nombre: string | null;
    pais: string | null;
    activo: boolean | null;
    evaluaciones: number;
  }>(`
    SELECT
      a."_id",
      COALESCE(a."nombreCompleto",
               NULLIF(TRIM(COALESCE(a."primerNombre",'') || ' ' || COALESCE(a."primerApellido",'')), ''),
               a."email") AS "nombre",
      a."pais",
      a."activo",
      COUNT(e.*)::int AS "evaluaciones"
    FROM "ADVISORS" a
    INNER JOIN "ACADEMICA_BOOKING_EVALUATIONS" e ON e."advisorId" = a."_id"
    GROUP BY a."_id", a."nombreCompleto", a."primerNombre", a."primerApellido", a."email", a."pais", a."activo"
    ORDER BY "nombre" ASC NULLS LAST
  `);

  return successResponse({ advisors: rows });
});
