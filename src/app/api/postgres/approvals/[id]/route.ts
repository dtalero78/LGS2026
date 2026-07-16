import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertPuedeAprobarContrato } from '@/lib/contrato-prueba-guard';

export const GET = handlerWithAuth(async (request, { params }) => {
  const result = await query(
    `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
    [params.id]
  );
  if (result.rowCount === 0) throw new NotFoundError('Person');
  return successResponse({ approval: result.rows[0] });
});

// Mapeo aprobacion → estado operativo del contrato
const APROBACION_TO_ESTADO: Record<string, string> = {
  'Aprobado':       'ACTIVA',
  'Pendiente':      'PENDIENTE',
  'Retractado':     'RETRACTADO',
  'Contrato nulo':  'ANULADO',
  'Devuelto':       'ANULADO',
  'Rechazado':      'ANULADO',
};

export const PUT = handlerWithAuth(async (request, { params }, session) => {
  const { estado } = await request.json();
  if (!estado) throw new ValidationError('estado is required');

  const validEstados = ['Aprobado', 'Rechazado', 'Pendiente', 'Contrato nulo', 'Devuelto', 'Retractado'];
  // Accept both uppercase API format and display format
  const estadoMap: Record<string, string> = {
    'APROBADO': 'Aprobado',
    'RECHAZADO': 'Rechazado',
    'PENDIENTE': 'Pendiente',
    'RETRACTADO': 'Retractado',
  };
  const estadoFinal = estadoMap[estado] || estado;

  if (!validEstados.includes(estadoFinal)) {
    throw new ValidationError(`estado must be one of: ${validEstados.join(', ')}`);
  }

  const check = await query(`SELECT "_id", "contrato" FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (check.rowCount === 0) throw new NotFoundError('Person');

  // Contratos de prueba (PRB-): solo SUPER_ADMIN puede aprobarlos.
  if (estadoFinal === 'Aprobado') {
    assertPuedeAprobarContrato(check.rows[0].contrato, (session?.user as any)?.role);
  }

  const estadoOperativo = APROBACION_TO_ESTADO[estadoFinal] ?? null;

  // Al aprobar, sella fechaIngreso con el día de hoy — pero solo la primera vez
  // (COALESCE no pisa una fecha existente). Consistente con /people/[id]/approve.
  const sealFecha = estadoFinal === 'Aprobado'
    ? `, "fechaIngreso" = COALESCE("fechaIngreso", NOW())`
    : '';

  const result = await query(
    `UPDATE "PEOPLE"
     SET "aprobacion" = $1,
         "estado" = COALESCE($2, "estado"),
         "_updatedDate" = NOW()${sealFecha}
     WHERE "_id" = $3 RETURNING *`,
    [estadoFinal, estadoOperativo, params.id]
  );

  return successResponse({ message: `Aprobación actualizada a: ${estadoFinal}`, approval: result.rows[0] });
});
