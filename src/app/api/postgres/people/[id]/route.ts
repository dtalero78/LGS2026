import { query, queryOne, queryMany, parseJsonbFields } from '@/lib/postgres';
import { handler, handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { attachKidsInscripciones } from '@/lib/kids-inscripciones';
import { nombreDe } from '@/lib/aprobacion-audit';
import { registrarEventoContrato } from '@/lib/contrato-eventos';
import { regenerarPdfTrasCambio } from '@/lib/regenerar-pdf-cambio';
import { actualizarPersona } from '@/lib/actualizar-persona';

/**
 * GET /api/postgres/people/[id]
 *
 * Get a person by ID with all their data
 * Returns person data, financial data (if contract exists), and related persons
 */
export const GET = handler(async (
  request: Request,
  { params }: { params: Record<string, string> }
) => {
  const personId = params.id;
  console.log('🔍 [PostgreSQL People] Getting person by ID:', personId);

  // Get person by _id
  const person = await queryOne(
    `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );

  if (!person) throw new NotFoundError('Person', personId);

  // Parse JSONB fields
  const parsedPerson = parseJsonbFields(person, [
    'onHoldHistory',
    'extensionHistory',
    'documentacion',
  ]);

  console.log('✅ [PostgreSQL People] Found person:', {
    id: parsedPerson?._id,
    nombre: `${parsedPerson?.primerNombre} ${parsedPerson?.primerApellido}`,
    tipoUsuario: parsedPerson?.tipoUsuario,
  });

  // Look up login password from USUARIOS_ROLES by email
  if (parsedPerson?.email) {
    try {
      const userLogin = await queryOne(
        `SELECT "password" FROM "USUARIOS_ROLES" WHERE "email" = $1`,
        [parsedPerson.email]
      );
      if (userLogin?.password) {
        const isBcrypt = userLogin.password.startsWith('$2a$') || userLogin.password.startsWith('$2b$') || userLogin.password.startsWith('$2y$');
        parsedPerson.claveLogin = isBcrypt ? '(Encriptada)' : userLogin.password;
      }
    } catch (e) {
      // Non-critical
    }
  }

  // Get financial data if contract exists
  let financialData = null;
  if (parsedPerson?.contrato) {
    const financial = await queryOne(
      `SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1 ORDER BY "_createdDate" DESC LIMIT 1`,
      [parsedPerson.contrato]
    );
    if (financial) {
      financialData = financial;
      console.log('✅ [PostgreSQL People] Found financial data for contract:', parsedPerson.contrato);
    }
  }

  // Get related persons (beneficiaries or titular)
  let relatedPersons: any[] = [];
  try {
    if (parsedPerson?.tipoUsuario === 'TITULAR') {
      // Get beneficiaries for this titular
      const beneficiaries = await queryMany(
        `SELECT
          "_id",
          "numeroId",
          "primerNombre",
          "segundoNombre",
          "primerApellido",
          "segundoApellido",
          "celular",
          "telefono",
          "estadoInactivo",
          "aprobacion",
          "nivel",
          "step",
          "kids",
          "_createdDate",
          (SELECT e."detalle" FROM "CONTRATO_EVENTOS" e
            WHERE e."personaId" = "PEOPLE"."_id" AND e."accion" = 'Beneficiario de reemplazo agregado'
            ORDER BY e."_createdDate" DESC LIMIT 1) AS "reemplazaA"
        FROM "PEOPLE"
        WHERE "contrato" = $1
          AND "tipoUsuario" = 'BENEFICIARIO'
        ORDER BY "primerNombre" ASC`,
        [parsedPerson.contrato]
      );

      // Check if each beneficiary exists in ACADEMICA (+ su nivel real).
      for (const ben of beneficiaries) {
        const academicCheck = await queryOne<{ _id: string; nivel: string | null }>(
          `SELECT "_id", "nivel" FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`,
          [ben.numeroId]
        );

        const nombreCompleto = [
          ben.primerNombre,
          ben.segundoNombre,
          ben.primerApellido,
          ben.segundoApellido,
        ]
          .filter(Boolean)
          .join(' ');

        relatedPersons.push({
          _id: ben._id,
          academicaId: academicCheck?._id || null,
          numeroId: ben.numeroId,
          nombreCompleto,
          celular: ben.celular || ben.telefono || '',
          estadoInactivo: ben.estadoInactivo || false,
          aprobacion: ben.aprobacion,
          nivel: ben.nivel,
          // Nivel real en ACADEMICA (WELCOME = aún no es usuario académico; BN1+ sí).
          academicaNivel: academicCheck?.nivel ?? null,
          existeEnAcademica: !!academicCheck,
          kids: (ben as any).kids === true,
          // Reemplazo hecho desde el Resumen de matrícula: prellena el comentario de aprobación.
          reemplazaA: (ben as any).reemplazaA || null,
          _createdDate: ben._createdDate,
        });
      }
      console.log('✅ [PostgreSQL People] Found', relatedPersons.length, 'beneficiaries');
    } else if (parsedPerson?.tipoUsuario === 'BENEFICIARIO' && parsedPerson?.contrato) {
      // Get titular for this beneficiary
      const titular = await queryOne(
        `SELECT
          "_id",
          "numeroId",
          "primerNombre",
          "segundoNombre",
          "primerApellido",
          "segundoApellido",
          "celular",
          "telefono",
          "estadoInactivo",
          "aprobacion",
          "_createdDate"
        FROM "PEOPLE"
        WHERE "contrato" = $1
          AND "tipoUsuario" = 'TITULAR'
        LIMIT 1`,
        [parsedPerson.contrato]
      );

      if (titular) {
        const nombreCompleto = [
          titular.primerNombre,
          titular.segundoNombre,
          titular.primerApellido,
          titular.segundoApellido,
        ]
          .filter(Boolean)
          .join(' ');

        relatedPersons.push({
          _id: titular._id,
          numeroId: titular.numeroId,
          nombreCompleto,
          celular: titular.celular || titular.telefono || '',
          estadoInactivo: titular.estadoInactivo || false,
          aprobacion: titular.aprobacion,
          _createdDate: titular._createdDate,
          isTitular: true,
        });
        console.log('✅ [PostgreSQL People] Found titular:', nombreCompleto);
      }
    }
  } catch (error) {
    console.error('⚠️ [PostgreSQL People] Error fetching related persons:', error);
    // Don't fail the whole request, just return empty related persons
  }

  // Si es un beneficiario Kids, adjunta su inscripción (campaña/curso/salón/horario
  // + apoderado) como `person.kidsInscripcion` para mostrarla en la ficha.
  if ((parsedPerson as any)?.kids === true && parsedPerson?.contrato) {
    await attachKidsInscripciones(parsedPerson.contrato, [parsedPerson as any]);
  }

  return successResponse({
    person: parsedPerson,
    financialData,
    relatedPersons,
  });
});

/**
 * PATCH /api/postgres/people/[id]
 *
 * Update a person's data. La lógica (validaciones, formato, propagación de
 * identidad a ACADEMICA/USUARIOS_ROLES/BOOKINGS/FINANCIEROS y Seguimiento) vive
 * en lib/actualizar-persona.ts, compartida con el Resumen de Matrícula.
 */
export const PATCH = handlerWithAuth(async (
  request: Request,
  { params }: { params: Record<string, string> },
  session
) => {
  const body = await request.json();
  return successResponse(await actualizarPersona(params.id, body, session));
});

/**
 * DELETE /api/postgres/people/[id]
 *
 * Delete a BENEFICIARIO from PEOPLE (and their ACADEMICA record if exists).
 * Only BENEFICIARIO type persons can be deleted via this endpoint.
 */
export const DELETE = handlerWithAuth(async (
  _request: Request,
  { params }: { params: Record<string, string> },
  session
) => {
  // Mismo permiso que el botón "Eliminar" de la ficha (antes solo pedía sesión).
  await requirePermission(session, PersonPermission.ELIMINAR);
  const personId = params.id;

  const person = await queryOne(
    `SELECT "_id", "numeroId", "tipoUsuario", "aprobacion", "contrato", "titularId", "primerNombre", "primerApellido" FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );

  if (!person) throw new NotFoundError('Person', personId);
  if (person.tipoUsuario !== 'BENEFICIARIO') {
    throw new ValidationError('Solo se pueden eliminar registros de tipo BENEFICIARIO');
  }
  // Un beneficiario APROBADO no se elimina (está o estuvo estudiando): se inactiva.
  // Antes solo lo impedía la pantalla.
  if (String(person.aprobacion || '').toUpperCase().startsWith('APROBAD')) {
    throw new ValidationError('No se puede eliminar un beneficiario aprobado. Use "Inactivar".');
  }

  // Ficha ACADEMICA: solo la de ESTE beneficiario (ligada a su fila o a su contrato)
  // y sin clases. Antes se borraba cualquier ficha con el mismo documento, aunque
  // fuera de otro contrato y con historial.
  await query(
    `DELETE FROM "ACADEMICA" a
      WHERE a."numeroId" = $1
        AND (a."usuarioId" = $2 OR a."contrato" = $3)
        AND NOT EXISTS (SELECT 1 FROM "ACADEMICA_BOOKINGS" b WHERE b."studentId" = a."_id" OR b."idEstudiante" = a."_id")`,
    [person.numeroId, personId, person.contrato]);

  // Kids: su inscripción (curso/apoderado) se va con él. Antes quedaba huérfana
  // y, al volver a crearlo, el niño tenía dos inscripciones. La reserva en
  // KIDS2026 se conserva: al recrearlo con el mismo documento KIDS la reutiliza.
  const insc = await query(
    `DELETE FROM "KIDS_INSCRIPCIONES" WHERE "beneficiarioId" = $1 RETURNING "kidsExternalRef"`,
    [personId]);
  const reservaKids = (insc.rows as any[]).find(r => r.kidsExternalRef)?.kidsExternalRef || null;

  // Delete from PEOPLE
  await query(`DELETE FROM "PEOPLE" WHERE "_id" = $1`, [personId]);

  // La fila ya no existe: se pasan sus datos para que el Seguimiento la ubique.
  await registrarEventoContrato({
    personaId: personId, categoria: 'BENEFICIARIOS', accion: 'Beneficiario eliminado',
    detalle: `${nombreDe(person) || ''} · documento ${person.numeroId || '—'}`, session,
    persona: { titularId: person.titularId, contrato: person.contrato, nombre: nombreDe(person), tipoUsuario: 'BENEFICIARIO' },
  });

  console.log('✅ [PostgreSQL People] Beneficiario deleted:', personId, reservaKids ? `(reserva KIDS ${reservaKids} se conserva)` : '');

  // Cambiaron las personas del contrato → PDF nuevo en el Drive (lib/regenerar-pdf-cambio).
  if (person.contrato) {
    regenerarPdfTrasCambio({ titularId: person.titularId || null, contrato: person.contrato, motivo: `Beneficiario eliminado: ${nombreDe(person) || person.numeroId}`, session });
  }
  return successResponse({ deleted: true, personId, reservaKids, pdfRegenerado: !!person.contrato });
});
