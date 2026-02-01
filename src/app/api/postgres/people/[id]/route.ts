import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryMany, parseJsonbFields } from '@/lib/postgres';

/**
 * GET /api/postgres/people/[id]
 *
 * Get a person by ID with all their data
 * Returns person data, financial data (if contract exists), and related persons
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personId = params.id;
    console.log('🔍 [PostgreSQL People] Getting person by ID:', personId);

    // Get person by _id
    const person = await queryOne(
      `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
      [personId]
    );

    if (!person) {
      console.log('⚠️ [PostgreSQL People] Person not found');
      return NextResponse.json(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

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

    return NextResponse.json({
      success: true,
      person: parsedPerson,
      financialData,
      relatedPersons,
    });
  } catch (error: any) {
    console.error('❌ [PostgreSQL People] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/postgres/people/[id]
 *
 * Update a person's data
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personId = params.id;
    const body = await request.json();

    console.log('🔄 [PostgreSQL People] Updating person:', personId);

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // List of allowed fields to update
    const allowedFields = [
      'primerNombre',
      'segundoNombre',
      'primerApellido',
      'segundoApellido',
      'email',
      'celular',
      'telefono',
      'fechaNacimiento',
      'direccion',
      'ciudad',
      'pais',
      'codigoPais',
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

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`"${field}" = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add _updatedDate
    updateFields.push(`"_updatedDate" = NOW()`);

    // Add person ID to values
    values.push(personId);

    const updateQuery = `
      UPDATE "PEOPLE"
      SET ${updateFields.join(', ')}
      WHERE "_id" = $${paramIndex}
      RETURNING *
    `;

    const result = await queryOne(updateQuery, values);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    // Parse JSONB fields
    const parsedPerson = parseJsonbFields(result, [
      'onHoldHistory',
      'extensionHistory',
    ]);

    console.log('✅ [PostgreSQL People] Person updated successfully');

    return NextResponse.json({
      success: true,
      person: parsedPerson,
    });
  } catch (error: any) {
    console.error('❌ [PostgreSQL People] Error updating:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
