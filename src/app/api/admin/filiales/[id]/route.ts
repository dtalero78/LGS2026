/**
 * DELETE /api/admin/filiales/[id] — elimina una filial del catálogo.
 *
 * Borrado físico: EQUIPO_COMERCIAL.filial guarda el nombre como snapshot,
 * así que borrar la filial del catálogo no afecta a comerciales ya creados.
 *
 * Permiso: MANTENIMIENTO.USUARIOS.CREAR_ROL (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { NotFoundError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

export const DELETE = handlerWithAuth(async (_req, ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const deleted = await queryOne<{ _id: string }>(
    `DELETE FROM "FILIALES" WHERE "_id" = $1 RETURNING "_id"`,
    [ctx.params.id],
  );
  if (!deleted) throw new NotFoundError('FILIALES', ctx.params.id);

  return successResponse({ deleted: true });
});
