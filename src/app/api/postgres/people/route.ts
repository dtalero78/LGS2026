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

  const existing = await queryOne(
    `SELECT "_id" FROM "PEOPLE" WHERE "numeroId" = $1`, [body.numeroId]
  );
  if (existing) throw new ConflictError(`Person with numeroId ${body.numeroId} already exists`);

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
    vigencia: body.vigencia, finalContrato: body.finalContrato, inicioCurso: body.inicioCurso,
    observaciones: body.observaciones, domicilio: body.domicilio, ciudad: body.ciudad,
    aprobacion: body.aprobacion, fechaIngreso: body.fechaIngreso,
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
