import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/students/[id]/step-override
 *
 * Mark a step as completed (override) for a student
 *
 * Body:
 * - step: string - Step name (e.g., "Step 1", "Step 2")
 * - completado: boolean - Whether the step is completed
 * - fechaCompletado: ISO date string (optional) - When the step was completed
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
    const { step, completado, fechaCompletado } = body;

    if (!step) {
      return NextResponse.json(
        { error: 'step is required' },
        { status: 400 }
      );
    }

    // Get student
    const studentResult = await query(
      `SELECT "_id", "numeroId", "nivel" FROM "PEOPLE"
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

    // Check if override already exists
    const existingResult = await query(
      `SELECT "_id", "completado" FROM "STEP_OVERRIDES"
       WHERE "studentId" = $1 AND "step" = $2`,
      [student._id, step]
    );

    if (existingResult.rowCount > 0) {
      // Update existing override
      const overrideId = existingResult.rows[0]._id;
      const updateResult = await query(
        `UPDATE "STEP_OVERRIDES"
         SET "completado" = $1,
             "fechaCompletado" = $2::timestamp with time zone,
             "modificadoPor" = $3,
             "modificadoPorEmail" = $4,
             "_updatedDate" = NOW()
         WHERE "_id" = $5
         RETURNING *`,
        [
          completado,
          fechaCompletado || new Date().toISOString(),
          session.user?.name || 'System',
          session.user?.email || 'system@lgs.com',
          overrideId,
        ]
      );

      return NextResponse.json({
        success: true,
        message: `Override actualizado para ${step}`,
        override: updateResult.rows[0],
      });
    } else {
      // Create new override
      const overrideId = `ovr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const insertResult = await query(
        `INSERT INTO "STEP_OVERRIDES" (
          "_id",
          "studentId",
          "numeroId",
          "nivel",
          "step",
          "completado",
          "fechaCompletado",
          "creadoPor",
          "creadoPorEmail",
          "modificadoPor",
          "modificadoPorEmail",
          "_createdDate",
          "_updatedDate"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::timestamp with time zone,
          $8, $9, $8, $9, NOW(), NOW()
        ) RETURNING *`,
        [
          overrideId,
          student._id,
          student.numeroId,
          student.nivel,
          step,
          completado,
          fechaCompletado || new Date().toISOString(),
          session.user?.name || 'System',
          session.user?.email || 'system@lgs.com',
        ]
      );

      return NextResponse.json({
        success: true,
        message: `Override creado para ${step}`,
        override: insertResult.rows[0],
      });
    }
  } catch (error: any) {
    console.error('❌ Error creating/updating step override:', error);
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
 * DELETE /api/postgres/students/[id]/step-override
 *
 * Remove a step override for a student
 *
 * Query params:
 * - step: string - Step name to remove override for
 */
export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const step = searchParams.get('step');

    if (!step) {
      return NextResponse.json(
        { error: 'step query parameter is required' },
        { status: 400 }
      );
    }

    // Get student ID
    const studentResult = await query(
      `SELECT "_id" FROM "PEOPLE" WHERE "_id" = $1 OR "numeroId" = $1`,
      [params.id]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const studentId = studentResult.rows[0]._id;

    // Delete override
    const deleteResult = await query(
      `DELETE FROM "STEP_OVERRIDES"
       WHERE "studentId" = $1 AND "step" = $2
       RETURNING "_id"`,
      [studentId, step]
    );

    if (deleteResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Override eliminado para ${step}`,
      deletedId: deleteResult.rows[0]._id,
    });
  } catch (error: any) {
    console.error('❌ Error deleting step override:', error);
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
 * GET /api/postgres/students/[id]/step-override
 *
 * Get all step overrides for a student
 *
 * Query params:
 * - step: string (optional) - Get override for specific step
 */
export async function GET(
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

    const { searchParams } = new URL(request.url);
    const step = searchParams.get('step');

    // Get student ID
    const studentResult = await query(
      `SELECT "_id" FROM "PEOPLE" WHERE "_id" = $1 OR "numeroId" = $1`,
      [params.id]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const studentId = studentResult.rows[0]._id;

    // Get overrides
    let overridesResult;
    if (step) {
      overridesResult = await query(
        `SELECT * FROM "STEP_OVERRIDES"
         WHERE "studentId" = $1 AND "step" = $2
         ORDER BY "_createdDate" DESC`,
        [studentId, step]
      );
    } else {
      overridesResult = await query(
        `SELECT * FROM "STEP_OVERRIDES"
         WHERE "studentId" = $1
         ORDER BY "step", "_createdDate" DESC`,
        [studentId]
      );
    }

    return NextResponse.json({
      success: true,
      overrides: overridesResult.rows,
      count: overridesResult.rowCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Error fetching step overrides:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
