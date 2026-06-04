/**
 * PATCH  /api/admin/plantillas/[id]    → edita una plantilla
 * DELETE /api/admin/plantillas/[id]    → soft delete (activo=false)
 *
 * Permiso: MANTENIMIENTO.PLANTILLAS.GESTION (SUPER_ADMIN/ADMIN bypass).
 * El slug NO se puede editar — es identificador estable.
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { MessageTemplatesRepository } from '@/repositories/message-templates.repository';
import { extractPlaceholders } from '@/lib/message-template-filler';

export const PATCH = handlerWithAuth(async (request, { params }, session) => {
  await requirePermission(session, MantenimientoPermission.PLANTILLAS_GESTION);
  const existing = await MessageTemplatesRepository.findById(params.id);
  if (!existing) throw new NotFoundError('Plantilla', params.id);

  const body = await request.json();
  const patch: any = {};

  if (body.nombre !== undefined) {
    const v = String(body.nombre || '').trim();
    if (!v || v.length > 120) throw new ValidationError('nombre requerido (máx 120 chars)');
    patch.nombre = v;
  }
  if (body.descripcion !== undefined) {
    patch.descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  }
  if (body.contenido !== undefined) {
    const v = String(body.contenido || '').trim();
    if (!v) throw new ValidationError('contenido requerido');
    if (v.length > 1000) throw new ValidationError('contenido no puede exceder 1000 caracteres');
    patch.contenido = v;
    patch.placeholders = extractPlaceholders(v);
  }
  if (body.activo !== undefined) {
    patch.activo = body.activo === true;
  }

  if (Object.keys(patch).length === 0) throw new ValidationError('Sin campos para actualizar');

  const updated = await MessageTemplatesRepository.update(params.id, patch);
  return successResponse({ template: updated });
});

export const DELETE = handlerWithAuth(async (_request, { params }, session) => {
  await requirePermission(session, MantenimientoPermission.PLANTILLAS_GESTION);
  const existing = await MessageTemplatesRepository.findById(params.id);
  if (!existing) throw new NotFoundError('Plantilla', params.id);

  // Soft delete — preserva historial. Si después se quiere "ocultar
  // completamente", se puede agregar un toggle 'includeInactive' al GET de gestión.
  const updated = await MessageTemplatesRepository.softDelete(params.id);
  return successResponse({ template: updated });
});
