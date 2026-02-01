import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/people
 *
 * Create a new person (TITULAR or BENEFICIARIO)
 *
 * Body: All PEOPLE table fields (most are optional)
 * Required:
 * - numeroId: string - Document number
 * - primerNombre: string
 * - primerApellido: string
 * - tipoUsuario: string - "TITULAR" or "BENEFICIARIO"
 *
 * Optional but common:
 * - segundoNombre, segundoApellido, email, celular, fechaNacimiento
 * - contrato (for BENEFICIARIO - links to TITULAR's contrato)
 * - nivel, step (for BENEFICIARIO - academic info)
 * - plataforma, estadoInactivo, vigencia, finalContrato
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.numeroId || !body.primerNombre || !body.primerApellido || !body.tipoUsuario) {
      return NextResponse.json(
        { error: 'numeroId, primerNombre, primerApellido, and tipoUsuario are required' },
        { status: 400 }
      );
    }

    // Check if numeroId already exists
    const existingResult = await query(
      `SELECT "_id", "numeroId" FROM "PEOPLE" WHERE "numeroId" = $1`,
      [body.numeroId]
    );

    if (existingResult.rowCount > 0) {
      return NextResponse.json(
        { error: `Person with numeroId ${body.numeroId} already exists` },
        { status: 409 }
      );
    }

    // Generate unique ID
    const personId = `per_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build insert query dynamically
    const fields = ['_id', 'numeroId', 'primerNombre', 'primerApellido', 'tipoUsuario'];
    const values: any[] = [
      personId,
      body.numeroId,
      body.primerNombre,
      body.primerApellido,
      body.tipoUsuario,
    ];
    let paramIndex = 6;

    // Optional fields
    const optionalFields: { [key: string]: any } = {
      segundoNombre: body.segundoNombre,
      segundoApellido: body.segundoApellido,
      email: body.email,
      celular: body.celular,
      fechaNacimiento: body.fechaNacimiento,
      contrato: body.contrato,
      nivel: body.nivel,
      step: body.step,
      nivelParalelo: body.nivelParalelo,
      stepParalelo: body.stepParalelo,
      plataforma: body.plataforma,
      estadoInactivo: body.estadoInactivo,
      vigencia: body.vigencia,
      finalContrato: body.finalContrato,
      inicioCurso: body.inicioCurso,
      observaciones: body.observaciones,
      direccion: body.direccion,
      ciudad: body.ciudad,
      pais: body.pais,
      codigoPais: body.codigoPais,
    };

    for (const [field, value] of Object.entries(optionalFields)) {
      if (value !== undefined && value !== null) {
        fields.push(field);
        values.push(value);
        paramIndex++;
      }
    }

    // Add timestamps and origen
    fields.push('origen', '_createdDate', '_updatedDate');
    values.push('POSTGRES');
    paramIndex += 2; // For NOW() calls

    const placeholders = fields.map((_, i) => {
      if (i >= fields.length - 2) return 'NOW()'; // For timestamps
      return `$${i + 1}`;
    });

    const insertQuery = `
      INSERT INTO "PEOPLE" (${fields.map((f) => `"${f}"`).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await query(insertQuery, values);

    // If BENEFICIARIO, also create ACADEMICA record
    if (body.tipoUsuario === 'BENEFICIARIO' && body.nivel && body.step) {
      const academicId = `aca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await query(
        `INSERT INTO "ACADEMICA" (
          "_id", "numeroId", "primerNombre", "segundoNombre",
          "primerApellido", "segundoApellido", "email", "celular",
          "nivel", "step", "plataforma", "_createdDate", "_updatedDate"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )`,
        [
          academicId,
          body.numeroId,
          body.primerNombre,
          body.segundoNombre || null,
          body.primerApellido,
          body.segundoApellido || null,
          body.email || null,
          body.celular || null,
          body.nivel,
          body.step,
          body.plataforma || null,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `${body.tipoUsuario} created successfully`,
      person: result.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error creating person:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
