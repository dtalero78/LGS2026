import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/contracts
 *
 * Create a complete contract with titular, beneficiarios, academic and financial records
 *
 * This is a complex transaction that creates multiple related records:
 * 1. TITULAR (PEOPLE) - Contract holder
 * 2. BENEFICIARIO(S) (PEOPLE) - Students
 * 3. ACADEMICA - Academic record for each beneficiario
 * 4. FINANCIEROS - Financial record for the contract
 *
 * Body:
 * - contrato: string - Contract number (e.g., "LGS-2025-001")
 * - titular: object - Titular data
 * - beneficiarios: array - Array of beneficiario data
 * - financiero: object - Financial data
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
    const { contrato, titular, beneficiarios, financiero } = body;

    // Validate required fields
    if (!contrato) {
      return NextResponse.json(
        { error: 'contrato is required' },
        { status: 400 }
      );
    }

    if (!titular || !titular.numeroId || !titular.primerNombre || !titular.primerApellido) {
      return NextResponse.json(
        { error: 'titular with numeroId, primerNombre, and primerApellido is required' },
        { status: 400 }
      );
    }

    if (!beneficiarios || !Array.isArray(beneficiarios) || beneficiarios.length === 0) {
      return NextResponse.json(
        { error: 'At least one beneficiario is required' },
        { status: 400 }
      );
    }

    // Check if contract already exists
    const existingContract = await query(
      `SELECT "contrato" FROM "PEOPLE" WHERE "contrato" = $1 LIMIT 1`,
      [contrato]
    );

    if (existingContract.rowCount > 0) {
      return NextResponse.json(
        { error: `Contract ${contrato} already exists` },
        { status: 409 }
      );
    }

    // Check if titular numeroId already exists
    const existingTitular = await query(
      `SELECT "numeroId" FROM "PEOPLE" WHERE "numeroId" = $1`,
      [titular.numeroId]
    );

    if (existingTitular.rowCount > 0) {
      return NextResponse.json(
        { error: `Titular with numeroId ${titular.numeroId} already exists` },
        { status: 409 }
      );
    }

    // Check if any beneficiario numeroId already exists
    for (const beneficiario of beneficiarios) {
      const existingBenef = await query(
        `SELECT "numeroId" FROM "PEOPLE" WHERE "numeroId" = $1`,
        [beneficiario.numeroId]
      );

      if (existingBenef.rowCount > 0) {
        return NextResponse.json(
          { error: `Beneficiario with numeroId ${beneficiario.numeroId} already exists` },
          { status: 409 }
        );
      }
    }

    // START TRANSACTION (PostgreSQL client would need BEGIN/COMMIT, but we'll do sequential operations)
    // In production, wrap these in a transaction

    const createdRecords: any = {
      contrato,
      titular: null,
      beneficiarios: [],
      academica: [],
      financiero: null,
    };

    // 1. Create TITULAR
    const titularId = `per_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const titularResult = await query(
      `INSERT INTO "PEOPLE" (
        "_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "email", "celular", "fechaNacimiento", "direccion", "ciudad", "pais", "codigoPais",
        "tipoUsuario", "contrato", "vigencia", "finalContrato", "inicioCurso",
        "observaciones", "origen", "_createdDate", "_updatedDate"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        'TITULAR', $14, $15, $16, $17, $18, 'POSTGRES', NOW(), NOW()
      ) RETURNING *`,
      [
        titularId,
        titular.numeroId,
        titular.primerNombre,
        titular.segundoNombre || null,
        titular.primerApellido,
        titular.segundoApellido || null,
        titular.email || null,
        titular.celular || null,
        titular.fechaNacimiento || null,
        titular.direccion || null,
        titular.ciudad || null,
        titular.pais || null,
        titular.codigoPais || null,
        contrato,
        titular.vigencia || null,
        titular.finalContrato || null,
        titular.inicioCurso || null,
        titular.observaciones || null,
      ]
    );

    createdRecords.titular = titularResult.rows[0];

    // 2. Create BENEFICIARIOS
    for (const beneficiario of beneficiarios) {
      const beneficiarioId = `per_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const benefResult = await query(
        `INSERT INTO "PEOPLE" (
          "_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
          "email", "celular", "fechaNacimiento", "direccion", "ciudad", "pais", "codigoPais",
          "tipoUsuario", "contrato", "nivel", "step", "nivelParalelo", "stepParalelo",
          "plataforma", "vigencia", "finalContrato", "inicioCurso", "estadoInactivo",
          "observaciones", "origen", "_createdDate", "_updatedDate"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          'BENEFICIARIO', $14, $15, $16, $17, $18, $19, $20, $21, $22, false,
          $23, 'POSTGRES', NOW(), NOW()
        ) RETURNING *`,
        [
          beneficiarioId,
          beneficiario.numeroId,
          beneficiario.primerNombre,
          beneficiario.segundoNombre || null,
          beneficiario.primerApellido,
          beneficiario.segundoApellido || null,
          beneficiario.email || null,
          beneficiario.celular || null,
          beneficiario.fechaNacimiento || null,
          beneficiario.direccion || null,
          beneficiario.ciudad || null,
          beneficiario.pais || null,
          beneficiario.codigoPais || null,
          contrato,
          beneficiario.nivel || 'WELCOME',
          beneficiario.step || 'WELCOME',
          beneficiario.nivelParalelo || null,
          beneficiario.stepParalelo || null,
          beneficiario.plataforma || 'ZOOM',
          titular.vigencia || null,
          titular.finalContrato || null,
          titular.inicioCurso || null,
          beneficiario.observaciones || null,
        ]
      );

      createdRecords.beneficiarios.push(benefResult.rows[0]);

      // 3. Create ACADEMICA record for beneficiario
      const academicaId = `aca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const academicaResult = await query(
        `INSERT INTO "ACADEMICA" (
          "_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
          "email", "celular", "nivel", "step", "plataforma", "origen", "_createdDate", "_updatedDate"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'POSTGRES', NOW(), NOW()
        ) RETURNING *`,
        [
          academicaId,
          beneficiario.numeroId,
          beneficiario.primerNombre,
          beneficiario.segundoNombre || null,
          beneficiario.primerApellido,
          beneficiario.segundoApellido || null,
          beneficiario.email || null,
          beneficiario.celular || null,
          beneficiario.nivel || 'WELCOME',
          beneficiario.step || 'WELCOME',
          beneficiario.plataforma || 'ZOOM',
        ]
      );

      createdRecords.academica.push(academicaResult.rows[0]);
    }

    // 4. Create FINANCIERO record (if provided)
    if (financiero) {
      const financieroId = `fin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const financieroResult = await query(
        `INSERT INTO "FINANCIEROS" (
          "_id", "contrato", "valorTotal", "modalidad", "cuotas", "valorCuota",
          "fechaPago", "proximoPago", "metodoPago", "estadoPago", "saldoPendiente",
          "observaciones", "descuento", "valorDescuento", "valorFinal",
          "origen", "_createdDate", "_updatedDate"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          'POSTGRES', NOW(), NOW()
        ) RETURNING *`,
        [
          financieroId,
          contrato,
          financiero.valorTotal || 0,
          financiero.modalidad || 'MENSUAL',
          financiero.cuotas || null,
          financiero.valorCuota || null,
          financiero.fechaPago || null,
          financiero.proximoPago || null,
          financiero.metodoPago || null,
          financiero.estadoPago || 'PENDIENTE',
          financiero.saldoPendiente || financiero.valorTotal || 0,
          financiero.observaciones || null,
          financiero.descuento || null,
          financiero.valorDescuento || null,
          financiero.valorFinal || financiero.valorTotal || 0,
        ]
      );

      createdRecords.financiero = financieroResult.rows[0];
    }

    return NextResponse.json({
      success: true,
      message: `Contract ${contrato} created successfully`,
      contract: createdRecords,
      summary: {
        contrato,
        titularCreated: true,
        beneficiariosCreated: createdRecords.beneficiarios.length,
        academicaRecordsCreated: createdRecords.academica.length,
        financieroCreated: !!createdRecords.financiero,
      },
    });
  } catch (error: any) {
    console.error('❌ Error creating contract:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
