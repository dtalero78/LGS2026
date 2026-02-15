import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/people/beneficiarios-sin-registro
 *
 * Get all beneficiarios without an academic record.
 */
export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const nivel = searchParams.get('nivel');
  const contrato = searchParams.get('contrato');

  const conditions: string[] = [`p."tipoUsuario" = 'BENEFICIARIO'`, `a."_id" IS NULL`];
  const values: any[] = [];
  let idx = 1;

  if (nivel) { conditions.push(`p."nivel" = $${idx}`); values.push(nivel); idx++; }
  if (contrato) { conditions.push(`p."contrato" = $${idx}`); values.push(contrato); idx++; }

  const beneficiarios = await queryMany(
    `SELECT p.*, NULL as "hasAcademicRecord"
     FROM "PEOPLE" p
     LEFT JOIN "ACADEMICA" a ON p."numeroId" = a."numeroId"
     WHERE ${conditions.join(' AND ')}
     ORDER BY p."primerApellido", p."primerNombre"`,
    values
  );

  return successResponse({
    beneficiarios,
    count: beneficiarios.length,
    message: beneficiarios.length === 0
      ? 'Todos los beneficiarios tienen registro académico'
      : `${beneficiarios.length} beneficiarios sin registro académico`,
  });
});
