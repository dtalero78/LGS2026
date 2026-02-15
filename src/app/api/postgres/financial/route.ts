import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { buildDynamicWhere } from '@/lib/query-builder';

export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();
  if (!body.contrato || !body.valorTotal || !body.modalidad) {
    throw new ValidationError('contrato, valorTotal, and modalidad are required');
  }

  const fields = ['_id', 'contrato', 'valorTotal', 'modalidad'];
  const values: any[] = [ids.financial(), body.contrato, body.valorTotal, body.modalidad];

  const optionalFields: Record<string, any> = {
    cuotas: body.cuotas, valorCuota: body.valorCuota, fechaPago: body.fechaPago,
    proximoPago: body.proximoPago, metodoPago: body.metodoPago, estadoPago: body.estadoPago,
    saldoPendiente: body.saldoPendiente, observaciones: body.observaciones,
    descuento: body.descuento, valorDescuento: body.valorDescuento, valorFinal: body.valorFinal,
  };

  for (const [field, value] of Object.entries(optionalFields)) {
    if (value !== undefined && value !== null) {
      fields.push(field);
      values.push(value);
    }
  }

  fields.push('origen', '_createdDate', '_updatedDate');
  values.push('POSTGRES');

  const placeholders = fields.map((_, i) => {
    if (i >= fields.length - 2) return 'NOW()';
    return `$${i + 1}`;
  });

  const result = await query(
    `INSERT INTO "FINANCIEROS" (${fields.map(f => `"${f}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  );

  return successResponse({ message: 'Financial record created successfully', financial: result.rows[0] });
});

export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const contrato = searchParams.get('contrato');
  const estadoPago = searchParams.get('estadoPago');

  const filters: Record<string, any> = {};
  if (contrato) filters.contrato = contrato;
  if (estadoPago) filters.estadoPago = estadoPago;

  const { whereClause, values } = buildDynamicWhere(filters);
  const result = await query(
    `SELECT * FROM "FINANCIEROS" ${whereClause} ORDER BY "_createdDate" DESC`,
    values
  );

  return successResponse({ financial: result.rows, count: result.rowCount || 0 });
});
