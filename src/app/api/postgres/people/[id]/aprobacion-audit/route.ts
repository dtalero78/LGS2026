import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { queryOne } from '@/lib/postgres';
import { NotFoundError } from '@/lib/errors';
import { listarAuditoriaContrato } from '@/lib/aprobacion-audit';

/**
 * GET /api/postgres/people/[id]/aprobacion-audit
 *
 * Historial de cambios de aprobación del CONTRATO de esta persona (titular +
 * beneficiarios), más reciente primero. Fuente: APROBACION_AUDIT.
 * Si la tabla aún no existe devuelve lista vacía (no rompe la ficha).
 */
export const GET = handlerWithStaffAuth(async (_req, { params }) => {
  const p = await queryOne<{ contrato: string | null }>(
    `SELECT "contrato" FROM "PEOPLE" WHERE "_id" = $1`, [params.id]
  );
  if (!p) throw new NotFoundError('Person', params.id);
  const registros = p.contrato ? await listarAuditoriaContrato(p.contrato) : [];
  return successResponse({ registros });
});
