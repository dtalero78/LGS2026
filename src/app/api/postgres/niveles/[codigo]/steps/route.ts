import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/niveles/[codigo]/steps
 *
 * Get all steps for a specific nivel
 *
 * Query params:
 * - studentId: string (optional) - Include student's progress/overrides for each step
 */
export async function GET(
  request: Request,
  { params }: { params: { codigo: string } }
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

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const nivelCodigo = decodeURIComponent(params.codigo);

    // Get nivel information
    const nivelResult = await query(
      `SELECT "code", "step", "steps", "esParalelo", "clubs", "description"
       FROM "NIVELES"
       WHERE "code" = $1
       ORDER BY "step"`,
      [nivelCodigo]
    );

    if (nivelResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Nivel not found' },
        { status: 404 }
      );
    }

    const nivelRecords = nivelResult.rows;
    const isParallel = nivelRecords[0]?.esParalelo === true;

    // Extract all unique steps
    const allSteps: any[] = [];
    const seenSteps = new Set<string>();

    for (const record of nivelRecords) {
      if (!seenSteps.has(record.step)) {
        seenSteps.add(record.step);
        allSteps.push({
          step: record.step,
          stepNumber: record.step.replace('Step ', ''),
          description: record.description || '',
        });
      }
    }

    // If studentId provided, get student's overrides and progress
    let studentProgress: any = null;
    if (studentId) {
      // Get student info
      const studentResult = await query(
        `SELECT "_id", "nivel", "step", "nivelParalelo", "stepParalelo"
         FROM "PEOPLE"
         WHERE "_id" = $1 OR "numeroId" = $1`,
        [studentId]
      );

      if (studentResult.rowCount > 0) {
        const student = studentResult.rows[0];

        // Get overrides for this nivel
        const overridesResult = await query(
          `SELECT "step", "completado", "fechaCompletado"
           FROM "STEP_OVERRIDES"
           WHERE "studentId" = $1 AND "nivel" = $2`,
          [student._id, nivelCodigo]
        );

        const overrides = overridesResult.rows.reduce((acc: any, row: any) => {
          acc[row.step] = {
            completado: row.completado,
            fechaCompletado: row.fechaCompletado,
          };
          return acc;
        }, {});

        // Get student's classes for this nivel
        const classesResult = await query(
          `SELECT DISTINCT "step", COUNT(*) as "totalClases"
           FROM "ACADEMICA_BOOKINGS"
           WHERE ("idEstudiante" = $1 OR "studentId" = $1)
             AND "nivel" = $2
             AND "asistio" = true
           GROUP BY "step"`,
          [student._id, nivelCodigo]
        );

        const classesByStep = classesResult.rows.reduce((acc: any, row: any) => {
          acc[row.step] = parseInt(row.totalClases) || 0;
          return acc;
        }, {});

        // Determine current step
        let currentStep;
        if (isParallel) {
          currentStep = student.nivelParalelo === nivelCodigo ? student.stepParalelo : null;
        } else {
          currentStep = student.nivel === nivelCodigo ? student.step : null;
        }

        studentProgress = {
          currentStep,
          overrides,
          classesByStep,
        };
      }
    }

    // Enhance steps with student progress if available
    const stepsWithProgress = allSteps.map((step) => {
      const stepData: any = { ...step };

      if (studentProgress) {
        stepData.isCurrentStep = studentProgress.currentStep === step.step;
        stepData.override = studentProgress.overrides[step.step] || null;
        stepData.totalClases = studentProgress.classesByStep[step.step] || 0;
      }

      return stepData;
    });

    return NextResponse.json({
      success: true,
      nivel: nivelCodigo,
      esParalelo: isParallel,
      totalSteps: allSteps.length,
      steps: stepsWithProgress,
      studentProgress: studentProgress ? {
        currentStep: studentProgress.currentStep,
        hasOverrides: Object.keys(studentProgress.overrides).length > 0,
      } : null,
    });
  } catch (error: any) {
    console.error('❌ Error fetching nivel steps:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
