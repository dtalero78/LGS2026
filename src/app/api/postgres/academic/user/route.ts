import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/academic/user
 *
 * Create a new academic record for a student
 *
 * Body:
 * - studentId: string - Student ID (_id or numeroId)
 * - nivel: string - Nivel code
 * - step: string - Step name
 * - advisor: string (optional) - Advisor email
 * - plataforma: string (optional) - Platform
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
    const { studentId, nivel, step, advisor, plataforma } = body;

    if (!studentId || !nivel || !step) {
      return NextResponse.json(
        { error: 'studentId, nivel, and step are required' },
        { status: 400 }
      );
    }

    // Get student details
    const studentResult = await query(
      `SELECT "_id", "numeroId", "primerNombre", "segundoNombre",
              "primerApellido", "segundoApellido", "email", "celular"
       FROM "PEOPLE"
       WHERE "_id" = $1 OR "numeroId" = $1`,
      [studentId]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentResult.rows[0];

    // Check if academic record already exists for this student
    const existingResult = await query(
      `SELECT "_id" FROM "ACADEMICA"
       WHERE "numeroId" = $1`,
      [student.numeroId]
    );

    if (existingResult.rowCount > 0) {
      // Update existing record
      const updateResult = await query(
        `UPDATE "ACADEMICA"
         SET "nivel" = $1,
             "step" = $2,
             "advisor" = $3,
             "plataforma" = $4,
             "_updatedDate" = NOW()
         WHERE "numeroId" = $5
         RETURNING *`,
        [
          nivel,
          step,
          advisor || null,
          plataforma || null,
          student.numeroId,
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Academic record updated',
        academica: updateResult.rows[0],
      });
    } else {
      // Create new record
      const academicId = `aca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertResult = await query(
        `INSERT INTO "ACADEMICA" (
          "_id",
          "numeroId",
          "primerNombre",
          "segundoNombre",
          "primerApellido",
          "segundoApellido",
          "email",
          "celular",
          "nivel",
          "step",
          "advisor",
          "plataforma",
          "_createdDate",
          "_updatedDate"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        ) RETURNING *`,
        [
          academicId,
          student.numeroId,
          student.primerNombre,
          student.segundoNombre,
          student.primerApellido,
          student.segundoApellido,
          student.email,
          student.celular,
          nivel,
          step,
          advisor || null,
          plataforma || null,
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Academic record created',
        academica: insertResult.rows[0],
      });
    }
  } catch (error: any) {
    console.error('❌ Error creating/updating academic record:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
