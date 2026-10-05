import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { queryOne, withTransaction } from '@/lib/postgres';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import { registrarCambioAprobacion, nombreDe } from '@/lib/aprobacion-audit';

/**
 * POST /api/postgres/contracts/anular-registro
 *   body: { personId, alcance: 'REGISTRO' | 'CONTRATO', motivo? }
 *
 * Resuelve un conflicto de la verificación del Crear Contrato ANULANDO (nunca
 * borrando) lo anterior:
 *   - REGISTRO: anula SOLO esa fila (beneficiario en un contrato pendiente).
 *   - CONTRATO: anula el contrato pendiente COMPLETO (titular + beneficiarios).
 * Anular = estado 'ANULADO', estadoInactivo=true, aprobacion='Contrato nulo'.
 * Queda en APROBACION_AUDIT y luego se depura en Mantenimiento › Limpieza de Anulados.
 *
 * Guardas: nunca un contrato/registro APROBADO; nunca un contrato con pagos
 * VALIDADOS (hay plata real: se gestiona desde la ficha).
 */
export const POST = handlerWithStaffAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}));
  const personId = String(body?.personId || '').trim();
  const alcance = body?.alcance === 'CONTRATO' ? 'CONTRATO' : 'REGISTRO';
  const motivo = String(body?.motivo || '').trim()
    || 'Anulado al crear un contrato nuevo para el mismo documento (verificación de Crear Contrato)';
  if (!personId) throw new ValidationError('personId requerido');

  const fila = await queryOne<any>(
    `SELECT "_id","contrato","tipoUsuario","aprobacion","primerNombre","primerApellido" FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );
  if (!fila) throw new NotFoundError('Persona', personId);
  if (!fila.contrato) throw new ValidationError('El registro no tiene contrato');
  if (String(fila.contrato).startsWith('PRB-')) throw new ValidationError('No aplica a contratos de prueba');

  // Filas a anular según el alcance.
  const titular = await queryOne<any>(
    `SELECT "_id","aprobacion" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
      ORDER BY "_createdDate" ASC LIMIT 1`,
    [fila.contrato]
  );
  const esAprobado = (a: any) => ['APROBADO', 'APROBADA'].includes(String(a || '').trim().toUpperCase());

  if (alcance === 'CONTRATO') {
    if (titular && esAprobado(titular.aprobacion)) {
      throw new ConflictError(`El contrato ${fila.contrato} ya está aprobado: no se puede anular desde aquí.`);
    }
    if (titular) {
      const pagos = await queryOne<{ n: string }>(
        `SELECT COUNT(*)::text n FROM "PAGOS_TITULARES" WHERE "idPeople" = $1 AND "validado" IS TRUE`, [titular._id]
      );
      if ((parseInt(pagos?.n ?? '0', 10) || 0) > 0) {
        throw new ConflictError(
          `El contrato ${fila.contrato} tiene pagos validados: no se puede anular desde aquí. Gestiónelo desde la ficha del titular.`
        );
      }
    }
  } else if (esAprobado(fila.aprobacion)) {
    throw new ConflictError(`Este registro del contrato ${fila.contrato} ya está aprobado: no se puede anular desde aquí.`);
  }

  const anulados = await withTransaction(async (client) => {
    // Lee (y bloquea) las filas ANTES del UPDATE para auditar su estado anterior.
    const previas = alcance === 'CONTRATO'
      ? await client.query(
          `SELECT "_id","contrato","tipoUsuario","primerNombre","primerApellido","aprobacion" FROM "PEOPLE"
            WHERE "contrato" = $1 AND COALESCE("aprobacion",'') NOT IN ('Aprobado','APROBADA') FOR UPDATE`,
          [fila.contrato])
      : await client.query(
          `SELECT "_id","contrato","tipoUsuario","primerNombre","primerApellido","aprobacion" FROM "PEOPLE"
            WHERE "_id" = $1 FOR UPDATE`,
          [personId]);
    const idsAnular = previas.rows.map((r: any) => r._id);
    if (idsAnular.length) {
      await client.query(
        `UPDATE "PEOPLE" SET "estado"='ANULADO', "estadoInactivo"=true, "aprobacion"='Contrato nulo', "_updatedDate"=NOW()
          WHERE "_id" = ANY($1::text[])`,
        [idsAnular]);
    }
    return previas.rows;
  });

  // Auditoría (best-effort), una entrada por fila anulada.
  for (const r of anulados) {
    await registrarCambioAprobacion({
      personId: r._id,
      contrato: r.contrato,
      tipoUsuario: r.tipoUsuario,
      nombre: nombreDe(r),
      estadoAnterior: r.aprobacion,
      estadoNuevo: 'Contrato nulo',
      origen: 'VERIFICACION_CREAR_CONTRATO',
      motivo,
      session,
    });
  }

  return successResponse({
    message: alcance === 'CONTRATO'
      ? `Contrato ${fila.contrato} anulado (${anulados.length} registro(s)).`
      : `Registro anulado en el contrato ${fila.contrato}.`,
    contrato: fila.contrato,
    anulados: anulados.length,
  });
});
