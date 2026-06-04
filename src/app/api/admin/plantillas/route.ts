/**
 * GET  /api/admin/plantillas         → lista plantillas (default solo activas)
 * POST /api/admin/plantillas         → crea una nueva plantilla
 *
 * Permiso: MANTENIMIENTO.PLANTILLAS.GESTION (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, ConflictError } from '@/lib/errors';
import { MessageTemplatesRepository } from '@/repositories/message-templates.repository';
import { extractPlaceholders } from '@/lib/message-template-filler';
import crypto from 'crypto';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export const GET = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.PLANTILLAS_GESTION);
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const items = await MessageTemplatesRepository.findAll({ includeInactive });
  return successResponse({ items });
});

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.PLANTILLAS_GESTION);
  const body = await request.json();
  const slug = String(body?.slug || '').trim().toLowerCase();
  const nombre = String(body?.nombre || '').trim();
  const descripcion = body?.descripcion ? String(body.descripcion).trim() : null;
  const contenido = String(body?.contenido || '').trim();

  if (!slug || !SLUG_REGEX.test(slug)) {
    throw new ValidationError('slug requerido — solo minúsculas, números y guiones (1-60 chars). Ej: "recordatorio-clase"');
  }
  if (!nombre || nombre.length > 120) throw new ValidationError('nombre requerido (máx 120 chars)');
  if (!contenido) throw new ValidationError('contenido requerido');
  if (contenido.length > 1000) throw new ValidationError('contenido no puede exceder 1000 caracteres');

  const dup = await MessageTemplatesRepository.findBySlug(slug);
  if (dup) throw new ConflictError(`Ya existe una plantilla con slug "${slug}". Usa otro identificador.`);

  // Auto-extraer placeholders del contenido — informativo, no bloquea.
  const placeholders = extractPlaceholders(contenido);

  const _id = `tpl_${crypto.randomUUID()}`;
  const created = await MessageTemplatesRepository.insertOne({
    _id, slug, nombre, descripcion, contenido, placeholders,
    activo: true,
    _owner: (session?.user as any)?.email || null,
  });
  return successResponse({ template: created });
});
