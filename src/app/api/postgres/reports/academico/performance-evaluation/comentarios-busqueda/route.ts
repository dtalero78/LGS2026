/**
 * GET /api/postgres/reports/academico/performance-evaluation/comentarios-busqueda
 *   ?advisorId | advisorIds & startDate & endDate & tipo & banda
 *
 * Comentarios de un advisor (o "Todos") filtrados por BANDA de promedio
 * (1→<2, 2→[2,3), 3→[3,4), 4→[4,5), 5→=5; ausente → sin tope), incluyendo la
 * IDENTIDAD del alumno (nombre + numeroId) que escribió cada uno.
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

  // `banda` = rango de promedio por entero (1..5). Ausente/'all'/0 → sin tope (todos).
  const bandaRaw = Number(searchParams.get('banda'));
  const banda = Number.isInteger(bandaRaw) && bandaRaw >= 1 && bandaRaw <= 5 ? bandaRaw : null;

  const comentarios = await EvaluationsRepository.searchComentarios({
    advisorId,
    advisorIds,
    startDate: searchParams.get('startDate'),
    endDate:   searchParams.get('endDate'),
    tipo:      searchParams.get('tipo'),
    banda,
  });

  return successResponse({ comentarios });
});
