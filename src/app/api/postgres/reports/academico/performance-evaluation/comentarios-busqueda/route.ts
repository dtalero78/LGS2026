/**
 * GET /api/postgres/reports/academico/performance-evaluation/comentarios-busqueda
 *   ?advisorId&startDate&endDate&tipo&tope
 *
 * Comentarios de UN advisor con promedio <= tope (de X estrellas hacia abajo),
 * incluyendo la IDENTIDAD del alumno (nombre + numeroId) que escribió cada uno.
 *
 * ⚠️ Des-anonimiza al alumno (el resto del dashboard NO lo hace) → gateado por un
 * permiso DEDICADO: ACADEMICO.PERFORMANCE_EVAL.BUSQUEDA_COMENTARIO
 * (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { EvaluationsRepository } from '@/repositories/evaluations.repository';

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, AcademicoPermission.PERFORMANCE_EVAL_BUSQUEDA_COMENTARIO);

  const { searchParams } = new URL(req.url);
  const advisorId = searchParams.get('advisorId');
  const advisorIdsRaw = searchParams.get('advisorIds');
  const advisorIds = advisorIdsRaw
    ? advisorIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : null;

  // Debe venir un advisor puntual O la lista "Todos" (advisorIds); si no, nada.
  if (!advisorId && !(advisorIds && advisorIds.length)) {
    return successResponse({ comentarios: [] });
  }

  const topeRaw = Number(searchParams.get('tope'));
  const tope = Number.isFinite(topeRaw) && topeRaw >= 1 && topeRaw <= 5 ? topeRaw : 3;

  const comentarios = await EvaluationsRepository.searchComentarios({
    advisorId,
    advisorIds,
    startDate: searchParams.get('startDate'),
    endDate:   searchParams.get('endDate'),
    tipo:      searchParams.get('tipo'),
    tope,
  });

  return successResponse({ comentarios });
});
