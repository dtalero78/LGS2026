import { NextRequest } from 'next/server';
import { query, queryOne, queryMany, parseJsonbFields } from '@/lib/postgres';
import { handler, handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { buildDynamicUpdate } from '@/lib/query-builder';

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
  ]);

  console.log('✅ [PostgreSQL People] Found person:', {
    id: parsedPerson?._id,
    nombre: `${parsedPerson?.primerNombre} ${parsedPerson?.primerApellido}`,
    tipoUsuario: parsedPerson?.tipoUsuario,
  });

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
          "_createdDate"
        FROM "PEOPLE"
        WHERE "contrato" = $1
          AND "tipoUsuario" = 'BENEFICIARIO'
        ORDER BY "primerNombre" ASC`,
        [parsedPerson.contrato]
      );

      // Check if each beneficiary exists in ACADEMICA
      for (const ben of beneficiaries) {
        const academicCheck = await queryOne(
          `SELECT "_id" FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`,
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
          numeroId: ben.numeroId,
          nombreCompleto,
          celular: ben.celular || ben.telefono || '',
          estadoInactivo: ben.estadoInactivo || false,
          aprobacion: ben.aprobacion,
          nivel: ben.nivel,
          existeEnAcademica: !!academicCheck,
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

  return successResponse({
    person: parsedPerson,
    financialData,
    relatedPersons,
  });
});

// Allowed fields for PATCH updates
const PEOPLE_UPDATE_FIELDS = [
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'email',
  'celular',
  'telefono',
  'fechaNacimiento',
  'domicilio',
  'ciudad',
  'nivel',
  'step',
  'nivelParalelo',
  'stepParalelo',
  'plataforma',
  'estadoInactivo',
  'aprobacion',
  'observaciones',
  'vigencia',
  'finalContrato',
  'inicioCurso',
];

/**
 * PATCH /api/postgres/people/[id]
 *
 * Update a person's data
 */
export const PATCH = handlerWithAuth(async (
  request: Request,
  { params }: { params: Record<string, string> }
) => {
  const personId = params.id;
  const body = await request.json();

  console.log('🔄 [PostgreSQL People] Updating person:', personId);

  const built = buildDynamicUpdate('PEOPLE', body, PEOPLE_UPDATE_FIELDS);
  if (!built) throw new ValidationError('No valid fields to update');

  // Add person ID as last parameter
  built.values.push(personId);

  const result = await queryOne(built.query, built.values);
  if (!result) throw new NotFoundError('Person', personId);

  // Parse JSONB fields
  const parsedPerson = parseJsonbFields(result, [
    'onHoldHistory',
    'extensionHistory',
  ]);

  console.log('✅ [PostgreSQL People] Person updated successfully');

  return successResponse({ person: parsedPerson });
});

/**
 * DELETE /api/postgres/people/[id]
 *
 * Delete a BENEFICIARIO from PEOPLE (and their ACADEMICA record if exists).
 * Only BENEFICIARIO type persons can be deleted via this endpoint.
 */
export const DELETE = handlerWithAuth(async (
  _request: Request,
  { params }: { params: Record<string, string> }
) => {
  const personId = params.id;

  const person = await queryOne(
    `SELECT "_id", "numeroId", "tipoUsuario" FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );

  if (!person) throw new NotFoundError('Person', personId);
  if (person.tipoUsuario !== 'BENEFICIARIO') {
    throw new ValidationError('Solo se pueden eliminar registros de tipo BENEFICIARIO');
  }

  // Delete from ACADEMICA if exists
  await query(`DELETE FROM "ACADEMICA" WHERE "numeroId" = $1`, [person.numeroId]);

  // Delete from PEOPLE
  await query(`DELETE FROM "PEOPLE" WHERE "_id" = $1`, [personId]);

  console.log('✅ [PostgreSQL People] Beneficiario deleted:', personId);

  return successResponse({ deleted: true, personId });
});
