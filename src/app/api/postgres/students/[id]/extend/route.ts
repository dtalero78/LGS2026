import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/students/[id]/extend
 *
 * Extend student's contract vigencia (finalContrato)
 *
 * Body:
 * - diasExtension: number - Number of days to extend
 * - motivo: string - Reason for extension
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const { diasExtension, motivo } = body;

    if (!diasExtension || diasExtension <= 0) {
      return NextResponse.json(
        { error: 'diasExtension must be a positive number' },
        { status: 400 }
      );
    }

    if (!motivo || motivo.trim() === '') {
      return NextResponse.json(
        { error: 'motivo is required' },
        { status: 400 }
      );
    }

    // Get student
    const studentResult = await query(
      `SELECT "_id", "numeroId", "finalContrato", "vigencia",
              "extensionCount", "extensionHistory"
       FROM "PEOPLE"
       WHERE "_id" = $1 OR "numeroId" = $1`,
      [params.id]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentResult.rows[0];

    if (!student.finalContrato) {
      return NextResponse.json(
        { error: 'Student does not have a finalContrato date' },
        { status: 400 }
      );
    }

    // Calculate new finalContrato
    const currentFinal = new Date(student.finalContrato);
    const newFinal = new Date(currentFinal);
    newFinal.setDate(newFinal.getDate() + diasExtension);

    // Calculate new vigencia (days from today to newFinal)
    const today = new Date();
    const diffTime = newFinal.getTime() - today.getTime();
    const newVigencia = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Create extension history entry
    const extensionHistory = student.extensionHistory || [];
    const newExtension = {
      numero: (student.extensionCount || 0) + 1,
      fechaEjecucion: new Date().toISOString(),
      vigenciaAnterior: currentFinal.toISOString().split('T')[0],
      vigenciaNueva: newFinal.toISOString().split('T')[0],
      diasExtendidos: diasExtension,
      motivo: motivo.trim(),
      ejecutadoPor: session.user?.name || 'System',
      ejecutadoPorEmail: session.user?.email || 'system@lgs.com',
    };

    extensionHistory.push(newExtension);

    // Update student
    const updateResult = await query(
      `UPDATE "PEOPLE"
       SET "finalContrato" = $1::date,
           "vigencia" = $2,
           "extensionCount" = COALESCE("extensionCount", 0) + 1,
           "extensionHistory" = $3::jsonb,
           "_updatedDate" = NOW()
       WHERE "_id" = $4
       RETURNING *`,
      [
        newFinal.toISOString().split('T')[0],
        newVigencia,
        JSON.stringify(extensionHistory),
        student._id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Vigencia extendida ${diasExtension} días exitosamente`,
      student: updateResult.rows[0],
      extension: {
        vigenciaAnterior: currentFinal.toISOString().split('T')[0],
        vigenciaNueva: newFinal.toISOString().split('T')[0],
        diasExtendidos: diasExtension,
        nuevaVigencia: newVigencia,
        motivo: motivo.trim(),
      },
    });
  } catch (error: any) {
    console.error('❌ Error extending vigencia:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
