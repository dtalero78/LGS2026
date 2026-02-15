import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';

export const GET = handlerWithAuth(async (request, { params }) => {
  const result = await query(
    `SELECT a.*, p."primerNombre", p."primerApellido", p."email" as "studentEmail", p."numeroId"
     FROM "APROBACIONES" a
     LEFT JOIN "PEOPLE" p ON a."studentId" = p."_id" OR a."numeroId" = p."numeroId"
     WHERE a."_id" = $1`,
    [params.id]
  );
  if (result.rowCount === 0) throw new NotFoundError('Approval');
  return successResponse({ approval: result.rows[0] });
});

export const PUT = handlerWithAuth(async (request, { params, session }) => {
  const { estado, comentarios } = await request.json();
  if (!estado) throw new ValidationError('estado is required');
  if (!['APROBADO', 'RECHAZADO', 'PENDIENTE'].includes(estado)) {
    throw new ValidationError('estado must be APROBADO, RECHAZADO, or PENDIENTE');
  }

  const check = await query(`SELECT "_id" FROM "APROBACIONES" WHERE "_id" = $1`, [params.id]);
  if (check.rowCount === 0) throw new NotFoundError('Approval');

  const result = await query(
    `UPDATE "APROBACIONES"
     SET "estado" = $1, "comentarios" = $2, "aprobadoPor" = $3, "aprobadoPorEmail" = $4,
         "fechaAprobacion" = NOW(), "_updatedDate" = NOW()
     WHERE "_id" = $5 RETURNING *`,
    [estado, comentarios || null, session.user?.name || 'System', session.user?.email || 'system@lgs.com', params.id]
  );

  const msg = estado === 'APROBADO' ? 'aprobada' : estado === 'RECHAZADO' ? 'rechazada' : 'actualizada';
  return successResponse({ message: `Aprobación ${msg} exitosamente`, approval: result.rows[0] });
});
