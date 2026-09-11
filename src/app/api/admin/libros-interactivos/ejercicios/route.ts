import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { EjerciciosInteractivosService } from '@/services/ejercicios-interactivos.service';

/**
 * GET  /api/admin/libros-interactivos/ejercicios         → lista de sets generados
 * POST /api/admin/libros-interactivos/ejercicios         → regenera un set { nivel, step }
 *
 * Gateado por ACADEMICO.MATERIAL.ACTUALIZAR.
 */
export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  await requirePermission(session, AcademicoPermission.ACTUALIZAR_MATERIAL);
  const sets = await EjerciciosInteractivosService.listSets();
  return successResponse({ sets });
});

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, AcademicoPermission.ACTUALIZAR_MATERIAL);
  const body = await req.json().catch(() => ({}));
  // Normalización IDÉNTICA a la que usa el estudiante al leer (getForStep):
  // nivel en MAYÚSCULAS + trim, step trim → regenera el MISMO row que se sirve.
  const nivel = String(body?.nivel || '').toUpperCase().trim();
  const step = String(body?.step || '').trim();
  const { ValidationError } = await import('@/lib/errors');
  if (!nivel || !step) throw new ValidationError('nivel y step son requeridos');
  const result = await EjerciciosInteractivosService.regenerateForStep(nivel, step);
  return successResponse({ nivel, step, ...result });
});
