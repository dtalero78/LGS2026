import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';

export const GET = handlerWithAuth(async (request, { params }) => {
  const result = await query(
    `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
    [params.id]
  );
  if (result.rowCount === 0) throw new NotFoundError('Person');
  return successResponse({ approval: result.rows[0] });
});

export const PUT = handlerWithAuth(async (request, { params }) => {
  const { estado } = await request.json();
  if (!estado) throw new ValidationError('estado is required');

  const validEstados = ['Aprobado', 'Rechazado', 'Pendiente', 'Contrato nulo', 'Devuelto'];
  // Accept both uppercase API format and display format
  const estadoMap: Record<string, string> = {
    'APROBADO': 'Aprobado',
    'RECHAZADO': 'Rechazado',
    'PENDIENTE': 'Pendiente',
  };
  const estadoFinal = estadoMap[estado] || estado;

  if (!validEstados.includes(estadoFinal)) {
    throw new ValidationError(`estado must be one of: ${validEstados.join(', ')}`);
  }

  const check = await query(`SELECT "_id" FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (check.rowCount === 0) throw new NotFoundError('Person');

  const result = await query(
    `UPDATE "PEOPLE" SET "aprobacion" = $1 WHERE "_id" = $2 RETURNING *`,
    [estadoFinal, params.id]
  );

  return successResponse({ message: `Aprobación actualizada a: ${estadoFinal}`, approval: result.rows[0] });
});
