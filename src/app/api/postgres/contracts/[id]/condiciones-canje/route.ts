import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ComercialPermission } from '@/types/permissions';
import { queryOne } from '@/lib/postgres';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

/**
 * PUT /api/postgres/contracts/[id]/condiciones-canje   body { condiciones: string[] }
 *
 * Corrige las condiciones de un contrato de CANJE (PEOPLE.condicionesCanje del
 * titular): editar, agregar o quitar. Mismas reglas que al crearlo (1..20, ≤300
 * c/u). Permiso COMERCIAL.CONTRATO.CANJE; un contrato ya APROBADO solo lo cambia
 * SUPER_ADMIN (misma regla que PUT /contracts/[id]).
 */
export const PUT = handlerWithStaffAuth(async (request, { params }, session) => {
  await requirePermission(session, ComercialPermission.CONTRATO_CANJE);

  const body = await request.json().catch(() => ({}));
  const condiciones: string[] = (Array.isArray(body?.condiciones) ? body.condiciones : [])
    .map((c: any) => String(c ?? '').trim()).filter(Boolean);
  if (!condiciones.length) throw new ValidationError('Escribe al menos una condición del canje.');
  if (condiciones.length > 20) throw new ValidationError('Máximo 20 condiciones de canje.');
  if (condiciones.some(c => c.length > 300)) throw new ValidationError('Cada condición del canje admite hasta 300 caracteres.');

  const titular = await queryOne<{ _id: string; tipoUsuario: string; tipoContrato: string | null; aprobacion: string | null }>(
    `SELECT "_id","tipoUsuario","tipoContrato","aprobacion" FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (!titular) throw new NotFoundError('Titular', params.id);
  if (titular.tipoUsuario !== 'TITULAR' || titular.tipoContrato !== 'CANJE') {
    throw new ValidationError('Este contrato no es de canje.');
  }
  const aprobado = String(titular.aprobacion || '').toUpperCase().startsWith('APROBAD');
  const rol = String((session?.user as any)?.role || '').toUpperCase();
  if (aprobado && rol !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Este contrato ya está aprobado: solo un Super Administrador puede cambiar sus condiciones.');
  }

  const row = await queryOne<{ condicionesCanje: string[] }>(
    `UPDATE "PEOPLE" SET "condicionesCanje" = $1::jsonb, "_updatedDate" = NOW()
      WHERE "_id" = $2 RETURNING "condicionesCanje"`,
    [JSON.stringify(condiciones), params.id]);

  return successResponse({ condicionesCanje: row?.condicionesCanje ?? condiciones });
});
