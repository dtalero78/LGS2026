import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { ValidationError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { queryOne, query } from '@/lib/postgres';
import { assertNoEsContratoPrueba } from '@/lib/contrato-prueba-guard';

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

  // Contratos de prueba (PRB-): no se pueden agregar beneficiarios/titulares
  // (y por tanto tampoco se crean fichas en ACADEMICA). Resuelve el contrato
  // del body o, si falta, del titular referenciado.
  let contratoTarget: string | null | undefined = body.contrato;
  if (!contratoTarget && body.titularId) {
    const t = await queryOne<{ contrato: string | null }>(
      `SELECT "contrato" FROM "PEOPLE" WHERE "_id" = $1`, [body.titularId],
    );
    contratoTarget = t?.contrato;
  }
  assertNoEsContratoPrueba(contratoTarget, 'agregar un beneficiario/titular');

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
    // Segmento infantil (mismo switch que Crear Contrato)
    kids: body.kids,
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

  // Kids: si el beneficiario se marcó como kid, guarda su inscripción (curso +
  // apoderado) en KIDS_INSCRIPCIONES. Best-effort (no rompe la creación).
  if (body.kids === true && body.kidsData) {
    const kd = body.kidsData;
    try {
      await query(
        `INSERT INTO "KIDS_INSCRIPCIONES"
           ("_id","contrato","beneficiarioId","numeroId","nombre","plataforma",
            "campaign","tipoCurso","horario","classroomId","salonNombre",
            "apoderado","apoderadoApellidos","apoderadoDoc","apoderadoTelefono","apoderadoMail","parentesco")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [ids.kidsInscripcion(), (person as any)?.contrato || contratoTarget || null, personId, body.numeroId,
         `${body.primerNombre || ''} ${body.primerApellido || ''}`.trim() || null,
         body.plataforma || (person as any)?.plataforma || null,
         kd.campaign || null, kd.tipoCurso || null, kd.horario || null, kd.classroomId || null, kd.salonNombre || null,
         kd.apoderado || null, kd.apoderadoApellidos || null, kd.apoderadoDoc || null,
         kd.apoderadoTelefono || null, kd.apoderadoMail || null, kd.parentesco || null]
      );
    } catch (e) {
      console.error('[people POST] Error guardando KIDS_INSCRIPCIONES (best-effort):', e);
    }
  }

  return successResponse({ message: `${body.tipoUsuario} created successfully`, person });
});
