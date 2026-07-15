import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { ValidationError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { queryOne } from '@/lib/postgres';

/**
 * POST /api/postgres/people
 *
 * Create a new person (TITULAR or BENEFICIARIO).
 */
export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();

  if (!body.numeroId || !body.primerNombre || !body.primerApellido || !body.tipoUsuario) {
    throw new ValidationError('numeroId, primerNombre, primerApellido, and tipoUsuario are required');
  }

  // El numeroId debe ser único acá. La ÚNICA excepción permitida en el sistema
  // es la creación de contrato (titular que además es su propio beneficiario),
  // que inserta directo en /api/postgres/contracts y no pasa por esta ruta.
  const existing = await queryOne<{ _id: string; tipoUsuario: string | null; contrato: string | null }>(
    `SELECT "_id", "tipoUsuario", "contrato" FROM "PEOPLE" WHERE "numeroId" = $1`, [body.numeroId]
  );
  if (existing) {
    throw new ConflictError(
      `Ya existe una persona con el número de identificación ${body.numeroId}` +
      `${existing.tipoUsuario ? ` (${existing.tipoUsuario}` : ''}` +
      `${existing.contrato ? ` — contrato ${existing.contrato})` : existing.tipoUsuario ? ')' : ''}.`
    );
  }

  const personId = ids.person();

  const fields = ['_id', 'numeroId', 'primerNombre', 'primerApellido', 'tipoUsuario'];
  const values: any[] = [personId, body.numeroId, body.primerNombre, body.primerApellido, body.tipoUsuario];
  let paramIndex = 6;

  const optionalFields: Record<string, any> = {
    segundoNombre: body.segundoNombre, segundoApellido: body.segundoApellido,
    email: body.email, celular: body.celular, fechaNacimiento: body.fechaNacimiento,
    contrato: body.contrato, nivel: body.nivel, step: body.step,
    nivelParalelo: body.nivelParalelo, stepParalelo: body.stepParalelo,
    plataforma: body.plataforma, estadoInactivo: body.estadoInactivo,
    vigencia: body.vigencia, finalContrato: body.finalContrato,
    observaciones: body.observaciones, domicilio: body.domicilio, ciudad: body.ciudad,
    aprobacion: body.aprobacion, fechaIngreso: body.fechaIngreso,
    // Vínculo formal con el titular + fechas del contrato al que se suma.
    // Sin `titularId` el beneficiario queda huérfano (la lista de /person/[id]
    // se arma por `contrato`, pero el vínculo formal se rompe).
    titularId: body.titularId,
    inicioContrato: body.inicioContrato, fechaContrato: body.fechaContrato,
  };

  for (const [field, value] of Object.entries(optionalFields)) {
    if (value !== undefined && value !== null) {
      fields.push(field); values.push(value); paramIndex++;
    }
  }

  fields.push('origen', '_createdDate', '_updatedDate');
  values.push('POSTGRES');

  const placeholders = fields.map((_, i) => {
    if (i >= fields.length - 2) return 'NOW()';
    return `$${i + 1}`;
  });

  const person = await queryOne(
    `INSERT INTO "PEOPLE" (${fields.map((f) => `"${f}"`).join(', ')})
     VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  );

  if (body.tipoUsuario === 'BENEFICIARIO' && body.nivel && body.step) {
    await AcademicaRepository.create({
      _id: ids.academic(), numeroId: body.numeroId,
      primerNombre: body.primerNombre, segundoNombre: body.segundoNombre || null,
      primerApellido: body.primerApellido, segundoApellido: body.segundoApellido || null,
      email: body.email || null, celular: body.celular || null,
      nivel: body.nivel, step: body.step,
      advisor: null, plataforma: body.plataforma || null,
    });
  }

  return successResponse({ message: `${body.tipoUsuario} created successfully`, person });
});
