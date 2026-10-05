import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { assertNoEsContratoPrueba } from '@/lib/contrato-prueba-guard';
import { registrarCambioAprobacion, nombreDe } from '@/lib/aprobacion-audit';

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

  const check = await query(
    `SELECT "_id", "contrato", "aprobacion", "tipoUsuario", "primerNombre", "primerApellido"
       FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (check.rowCount === 0) throw new NotFoundError('Person');
  const actual = check.rows[0];

  // Un contrato YA APROBADO solo cambia de estado desde la ficha del titular
  // (Estado del Titular): ahí hay modal de advertencia, motivo obligatorio y las
  // reglas de reversión. Este endpoint (pantalla de Aprobación) solo opera sobre
  // contratos aún no aprobados.
  if (actual.aprobacion === 'Aprobado' && estadoFinal !== 'Aprobado') {
    throw new ValidationError(
      'Este contrato ya está aprobado. Para cambiar su estado usa la ficha del titular (Estado del Titular), donde se registra el motivo.'
    );
  }

  // Contratos de prueba (PRB-): NADIE puede aprobarlos (tampoco SUPER_ADMIN).
  if (estadoFinal === 'Aprobado') {
    assertNoEsContratoPrueba(check.rows[0].contrato, 'aprobar el contrato');
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

  await registrarCambioAprobacion({
    personId: params.id,
    contrato: actual.contrato,
    tipoUsuario: actual.tipoUsuario,
    nombre: nombreDe(actual),
    estadoAnterior: actual.aprobacion,
    estadoNuevo: estadoFinal,
    origen: 'PANTALLA_APROBACION',
    session,
  });

  return successResponse({ message: `Aprobación actualizada a: ${estadoFinal}`, approval: result.rows[0] });
});
