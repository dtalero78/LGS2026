import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * PUT /api/postgres/students/contract
 *
 * Manually extend student contract
 *
 * - Extends finalContrato by specified days or to specific date
 * - Recalculates vigencia (days remaining)
 * - Adds entry to extensionHistory
 * - Increments extensionCount
 *
 * Body:
 * {
 *   studentId: string,           // _id of student in PEOPLE table
 *   diasExtendidos?: number,     // Number of days to extend (if using days method)
 *   nuevaFecha?: string,         // New end date (if using date method)
 *   motivo: string               // Reason for extension (required)
 * }
 *
 * Note: Must provide either diasExtendidos OR nuevaFecha (not both)
 */
export async function PUT(request: Request) {
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
    if (!body.studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      );
    }

    if (!body.motivo) {
      return NextResponse.json(
        { error: 'motivo is required' },
        { status: 400 }
      );
    }

    // Validate extension method
    if (!body.diasExtendidos && !body.nuevaFecha) {
      return NextResponse.json(
        { error: 'Either diasExtendidos or nuevaFecha is required' },
        { status: 400 }
      );
    }

    if (body.diasExtendidos && body.nuevaFecha) {
      return NextResponse.json(
        { error: 'Provide either diasExtendidos OR nuevaFecha, not both' },
        { status: 400 }
      );
    }

    // Get current student data
    const studentResult = await query(
      `SELECT "_id", "finalContrato", "extensionCount", "extensionHistory"
       FROM "PEOPLE"
       WHERE "_id" = $1`,
      [body.studentId]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentResult.rows[0];

    // Parse extensionHistory
    let extensionHistory = Array.isArray(student.extensionHistory)
      ? student.extensionHistory
      : JSON.parse(student.extensionHistory || '[]');

    // Calculate new finalContrato
    const currentFinalContrato = new Date(student.finalContrato);
    let newFinalContrato: Date;
    let diasExtendidos: number;

    if (body.diasExtendidos) {
      // Method 1: Extend by days
      diasExtendidos = body.diasExtendidos;
      newFinalContrato = new Date(currentFinalContrato);
      newFinalContrato.setDate(newFinalContrato.getDate() + diasExtendidos);
    } else {
      // Method 2: Set new end date
      newFinalContrato = new Date(body.nuevaFecha);

      // Validate new date is after current date
      if (newFinalContrato <= currentFinalContrato) {
        return NextResponse.json(
          { error: 'New date must be after current finalContrato' },
          { status: 400 }
        );
      }

      // Calculate days extended
      diasExtendidos = Math.ceil(
        (newFinalContrato.getTime() - currentFinalContrato.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Add entry to extensionHistory
    const newExtensionEntry = {
      numero: (student.extensionCount || 0) + 1,
      fechaEjecucion: new Date().toISOString(),
      vigenciaAnterior: currentFinalContrato.toISOString().split('T')[0],
      vigenciaNueva: newFinalContrato.toISOString().split('T')[0],
      diasExtendidos: diasExtendidos,
      motivo: body.motivo,
      ejecutadoPor: session.user?.name || session.user?.email || 'Unknown'
    };

    extensionHistory.push(newExtensionEntry);

    // Calculate new vigencia (days remaining)
    const today = new Date();
    const daysRemaining = Math.ceil(
      (newFinalContrato.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Update student
    const result = await query(
      `UPDATE "PEOPLE"
       SET "finalContrato" = $1::timestamp with time zone,
           "vigencia" = $2,
           "extensionCount" = COALESCE("extensionCount", 0) + 1,
           "extensionHistory" = $3::jsonb,
           "_updatedDate" = NOW()
       WHERE "_id" = $4
       RETURNING *`,
      [
        newFinalContrato.toISOString(),
        daysRemaining.toString(),
        JSON.stringify(extensionHistory),
        body.studentId
      ]
    );

    return NextResponse.json({
      success: true,
      student: result.rows[0],
      message: `Contrato extendido exitosamente por ${diasExtendidos} días`,
      extension: {
        diasExtendidos,
        previousFinalContrato: currentFinalContrato.toISOString().split('T')[0],
        newFinalContrato: newFinalContrato.toISOString().split('T')[0],
        newVigencia: daysRemaining,
        motivo: body.motivo
      },
      extensionEntry: newExtensionEntry
    });
  } catch (error: any) {
    console.error('❌ Error extending contract:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
