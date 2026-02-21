import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { buildDynamicWhere } from '@/lib/query-builder';

export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado') || 'PENDIENTE';
  const tipo = searchParams.get('tipo');

  const filters: Record<string, any> = { estado };
  if (tipo) filters.tipo = tipo;

  const { whereClause, values } = buildDynamicWhere(filters);

  const result = await query(
    `SELECT a.*, p."primerNombre", p."primerApellido", p."email" as "studentEmail", p."numeroId", p."hashConsentimiento"
     FROM "APROBACIONES" a
     LEFT JOIN "PEOPLE" p ON a."studentId" = p."_id" OR a."numeroId" = p."numeroId"
     ${whereClause}
     ORDER BY a."_createdDate" DESC`,
    values
  );

  return successResponse({
    approvals: result.rows,
    count: result.rowCount || 0,
    filters: { tipo: tipo || null, estado },
  });
});
