import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/financial
 *
 * Create a new financial record
 *
 * Body:
 * Required:
 * - contrato: string - Contract number
 * - valorTotal: number - Total contract value
 * - modalidad: string - Payment modality (e.g., "MENSUAL", "TRIMESTRAL")
 *
 * Optional:
 * - cuotas, valorCuota, fechaPago, metodoPago, estadoPago, etc.
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
    if (!body.contrato || !body.valorTotal || !body.modalidad) {
      return NextResponse.json(
        { error: 'contrato, valorTotal, and modalidad are required' },
        { status: 400 }
      );
    }

    // Generate unique ID
    const financialId = `fin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build insert query dynamically
    const fields = ['_id', 'contrato', 'valorTotal', 'modalidad'];
    const values: any[] = [financialId, body.contrato, body.valorTotal, body.modalidad];
    let paramIndex = 5;

    // Optional fields
    const optionalFields: { [key: string]: any } = {
      cuotas: body.cuotas,
      valorCuota: body.valorCuota,
      fechaPago: body.fechaPago,
      proximoPago: body.proximoPago,
      metodoPago: body.metodoPago,
      estadoPago: body.estadoPago,
      saldoPendiente: body.saldoPendiente,
      observaciones: body.observaciones,
      descuento: body.descuento,
      valorDescuento: body.valorDescuento,
      valorFinal: body.valorFinal,
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
      INSERT INTO "FINANCIEROS" (${fields.map((f) => `"${f}"`).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await query(insertQuery, values);

    return NextResponse.json({
      success: true,
      message: 'Financial record created successfully',
      financial: result.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error creating financial record:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/postgres/financial
 *
 * Get financial records with optional filters
 *
 * Query params:
 * - contrato: string - Filter by contract number
 * - estadoPago: string - Filter by payment status
 */
export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contrato = searchParams.get('contrato');
    const estadoPago = searchParams.get('estadoPago');

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (contrato) {
      conditions.push(`"contrato" = $${paramIndex}`);
      values.push(contrato);
      paramIndex++;
    }

    if (estadoPago) {
      conditions.push(`"estadoPago" = $${paramIndex}`);
      values.push(estadoPago);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM "FINANCIEROS" ${whereClause} ORDER BY "_createdDate" DESC`,
      values
    );

    return NextResponse.json({
      success: true,
      financial: result.rows,
      count: result.rowCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Error fetching financial records:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
