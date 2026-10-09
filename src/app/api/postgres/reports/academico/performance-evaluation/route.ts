/**
 * GET /api/postgres/reports/academico/performance-evaluation
 *   ?startDate&endDate&advisorId&nivel&tipo&plataforma&comentarioSearch
 *
 * Stats agregadas para el dashboard de Performance Evaluation V2.
 * Gateado por ACADEMICO.PERFORMANCE_EVAL.VER (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { successResponse } from '@/lib/api-helpers';
import { handlerReport } from '@/lib/report-guard';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { getDashboardStats } from '@/services/evaluations.service';
import { advisorIdsFiltro, restringirAdvisors } from '@/lib/filtro-advisors-chile';

export const GET = handlerReport(async (req, _ctx, session) => {
  await requirePermission(session, AcademicoPermission.PERFORMANCE_EVAL_VER);

  const { searchParams } = new URL(req.url);
  const advisorIdsRaw = searchParams.get('advisorIds');
  let advisorIds = advisorIdsRaw
    ? advisorIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : null;
  let advisorId = searchParams.get('advisorId');
  // Filtro temporal de capacitación (src/lib/filtro-advisors-chile.ts)
  const idsChile = await advisorIdsFiltro(session);
  if (idsChile) ({ advisorId, advisorIds } = restringirAdvisors(idsChile, advisorId, advisorIds));
  const stats = await getDashboardStats({
    startDate: searchParams.get('startDate'),
    endDate:   searchParams.get('endDate'),
    advisorId,
    advisorIds,
    nivel:     searchParams.get('nivel'),
    tipo:      searchParams.get('tipo'),
    plataforma: searchParams.get('plataforma'),
    comentarioSearch: searchParams.get('comentarioSearch'),
  });
  return successResponse(idsChile ? { ...stats, filtroAdvisorsChile: true } : stats);
});
