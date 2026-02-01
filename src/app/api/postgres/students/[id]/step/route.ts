import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * PUT /api/postgres/students/[id]/step
 *
 * Update student's step (nivel and step)
 *
 * Body:
 * - newStep: string - The step code (e.g., "1", "2", "6", "0" for ESS)
 *
 * This endpoint will:
 * 1. Get the nivel and step names from NIVELES table based on step code
 * 2. Check if the nivel is parallel (esParalelo)
 * 3. Update PEOPLE and ACADEMICA tables accordingly
 * 4. If parallel: Update nivelParalelo/stepParalelo
 * 5. If not parallel: Update nivel/step
 */
export async function PUT(
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
    const { newStep } = body;

    if (!newStep) {
      return NextResponse.json(
        { error: 'newStep is required' },
        { status: 400 }
      );
    }

    // Get student
    const studentResult = await query(
      `SELECT "_id", "numeroId", "nivel", "step", "nivelParalelo", "stepParalelo"
       FROM "PEOPLE" WHERE "_id" = $1 OR "numeroId" = $1`,
      [params.id]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentResult.rows[0];

    // Find the nivel and step from NIVELES table
    const nivelResult = await query(
      `SELECT "code", "step", "esParalelo"
       FROM "NIVELES"
       WHERE "step" = $1
       LIMIT 1`,
      [`Step ${newStep}`]
    );

    if (nivelResult.rowCount === 0) {
      return NextResponse.json(
        { error: `Step "${newStep}" not found in NIVELES table` },
        { status: 404 }
      );
    }

    const nivelData = nivelResult.rows[0];
    const isParallel = nivelData.esParalelo === true;
    const newNivel = nivelData.code;
    const newStepName = nivelData.step;

    // Prepare update based on whether it's a parallel nivel
    let updateFields: { [key: string]: any } = {};

    if (isParallel) {
      // Update parallel level fields
      updateFields = {
        nivelParalelo: newNivel,
        stepParalelo: newStepName,
      };
    } else {
      // Update main level fields
      updateFields = {
        nivel: newNivel,
        step: newStepName,
      };
    }

    // Update PEOPLE table
    const peopleUpdateQuery = `
      UPDATE "PEOPLE"
      SET ${Object.keys(updateFields)
        .map((key, index) => `"${key}" = $${index + 2}`)
        .join(', ')},
          "_updatedDate" = NOW()
      WHERE "_id" = $1
      RETURNING *
    `;
    const peopleValues = [student._id, ...Object.values(updateFields)];
    const peopleUpdateResult = await query(peopleUpdateQuery, peopleValues);

    // Update ACADEMICA table (if student has academic records)
    const academicaUpdateQuery = `
      UPDATE "ACADEMICA"
      SET ${Object.keys(updateFields)
        .map((key, index) => `"${key}" = $${index + 2}`)
        .join(', ')},
          "_updatedDate" = NOW()
      WHERE "numeroId" = $1
    `;
    const academicaValues = [student.numeroId, ...Object.values(updateFields)];
    await query(academicaUpdateQuery, academicaValues);

    return NextResponse.json({
      success: true,
      message: `Step actualizado exitosamente a ${newNivel} - ${newStepName}`,
      student: peopleUpdateResult.rows[0],
      isParallel,
      updatedFields: updateFields,
    });
  } catch (error: any) {
    console.error('❌ Error updating student step:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
