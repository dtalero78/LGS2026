import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { verificarDocumento } from '@/lib/verificacion-documento';
import { kidsIntake } from '@/lib/kids-intake';
import { buildKidsReservation, plataformaToCountryCode, toISODate } from '@/lib/kids-mapping';
import { ValidationError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { queryOne, query } from '@/lib/postgres';
import { assertNoEsContratoPrueba } from '@/lib/contrato-prueba-guard';

/**
 * POST /api/postgres/people
 *
 * Create a new person (TITULAR or BENEFICIARIO).
 */
// Solo staff: un ESTUDIANTE no crea personas.
export const POST = handlerWithStaffAuth(async (request) => {
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

  // Kids con KIDS2026 conectado: el salón es obligatorio (sin él no se envía la reserva).
  if (body.kids === true && kidsIntake.isConfigured() && !body.kidsData?.classroomId && !/^PRB-/i.test(String(contratoTarget || ''))) {
    throw new ValidationError('Falta elegir campaña, curso y salón de KIDS para este beneficiario.');
  }

  if (body.tipoUsuario === 'BENEFICIARIO') {
    // Regla (2026-10-06): no se agrega un beneficiario si el documento ya es
    // BENEFICIARIO ACTIVO en un contrato vivo (incluido este). Un documento que
    // solo aparece en contratos muertos (finalizados, anulados, retractados,
    // inactivos sin OnHold) o como titular SÍ se puede agregar (re-matrícula).
    // Mismo criterio "vivo" de la verificación de Crear Contrato.
    const activo = (await verificarDocumento(String(body.numeroId))).find(r => r.tipoUsuario !== 'TITULAR');
    if (activo) {
      throw new ConflictError(
        `Ya hay un beneficiario activo con el número de identificación ${body.numeroId}: ` +
        `${activo.nombre || 'sin nombre'} — contrato ${activo.contrato}` +
        `${activo.situacion === 'APROBADO' ? ' (aprobado)' : ' (pendiente de aprobación)'}.`
      );
    }
  } else {
    // TITULAR (u otro tipo) por esta ruta: el numeroId debe ser único. La creación
    // normal de contratos entra por /api/postgres/contracts, no por aquí.
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
    const kidsInscId = ids.kidsInscripcion();
    const contratoKids = (person as any)?.contrato || contratoTarget || null;
    try {
      await query(
        `INSERT INTO "KIDS_INSCRIPCIONES"
           ("_id","contrato","beneficiarioId","numeroId","nombre","plataforma",
            "campaign","tipoCurso","horario","classroomId","salonNombre",
            "apoderado","apoderadoApellidos","apoderadoDoc","apoderadoTelefono","apoderadoMail","parentesco")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [kidsInscId, contratoKids, personId, body.numeroId,
         `${body.primerNombre || ''} ${body.primerApellido || ''}`.trim() || null,
         body.plataforma || (person as any)?.plataforma || null,
         kd.campaign || null, kd.tipoCurso || null, kd.horario || null, kd.classroomId || null, kd.salonNombre || null,
         kd.apoderado || null, kd.apoderadoApellidos || null, kd.apoderadoDoc || null,
         kd.apoderadoTelefono || null, kd.apoderadoMail || null, kd.parentesco || null]
      );
    } catch (e) {
      console.error('[people POST] Error guardando KIDS_INSCRIPCIONES (best-effort):', e);
    }

    // Enviar la reserva a KIDS2026 — mismo flujo que Crear Contrato (antes faltaba
    // aquí: un kid agregado desde la ficha nunca llegaba a KIDS y al aprobarlo no
    // había reserva que activar). Best-effort: no rompe la creación.
    if (kidsIntake.isConfigured() && kd.classroomId && contratoKids) {
      try {
        const titular = await queryOne<any>(
          body.titularId
            ? `SELECT * FROM "PEOPLE" WHERE "_id" = $1`
            : `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' ORDER BY "_createdDate" ASC LIMIT 1`,
          [body.titularId || contratoKids]);
        if (!titular) throw new Error('Titular no encontrado para la reserva Kids');
        const input = buildKidsReservation({
          externalRef: `${contratoKids}#${body.numeroId}`,
          countryCode: plataformaToCountryCode(titular.plataforma || body.plataforma),
          inicio: new Date().toISOString().slice(0, 10),
          finalContrato: toISODate(body.finalContrato || titular.finalContrato),
          titular,
          beneficiario: body,
          kidsData: kd,
        });
        const r = await kidsIntake.createReservation(input);
        await query(
          `UPDATE "KIDS_INSCRIPCIONES"
             SET "enviadoAKids"=true, "kidsExternalRef"=$2, "kidsContractId"=$3,
                 "kidsEnrollmentId"=$4, "fechaEnvioKids"=NOW(), "errorKids"=NULL, "_updatedDate"=NOW()
           WHERE "_id"=$1`,
          [kidsInscId, r.externalRef, r.contractId, r.enrollmentId]);
      } catch (e: any) {
        console.error('[people POST] Error enviando reserva a KIDS (best-effort):', e?.message);
        await query(`UPDATE "KIDS_INSCRIPCIONES" SET "errorKids"=$2, "_updatedDate"=NOW() WHERE "_id"=$1`,
          [kidsInscId, String(e?.message || 'error').slice(0, 500)]).catch(() => null);
      }
    }
  }

  return successResponse({ message: `${body.tipoUsuario} created successfully`, person });
});
