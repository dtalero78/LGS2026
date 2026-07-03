/**
 * PATCH /api/admin/libros-interactivos/feature-flag
 *
 * Body: { active: boolean, flag?: 'v2' | 'clasico' | 'ejercicios' }
 *
 * Activa/desactiva un flag del Material Interactivo:
 *   - flag='v2' (default): visor v2 global (material_interactivo_v2_activo)
 *   - flag='clasico'      : botón clásico Wix (material_interactivo_clasico_activo)
 *   - flag='ejercicios'   : Fase 2 práctica (material_interactivo_ejercicios_activo)
 * Gateado por permiso ACADEMICO.MATERIAL.ACTUALIZAR.
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { LibrosInteractivosService } from '@/services/libros-interactivos.service';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';

export const PATCH = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, AcademicoPermission.ACTUALIZAR_MATERIAL);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') {
    throw new ValidationError('Body debe incluir "active" boolean');
  }
  const flag = ['clasico', 'ejercicios'].includes(body?.flag) ? body.flag : 'v2';
  const actor = (session.user as any)?.email || 'admin';
  if (flag === 'clasico') {
    await LibrosInteractivosService.setClasicoActive(body.active, actor);
  } else if (flag === 'ejercicios') {
    await LibrosInteractivosService.setEjerciciosActive(body.active, actor);
  } else {
    await LibrosInteractivosService.setFeatureActive(body.active, actor);
  }
  return successResponse({ active: body.active, flag });
});
