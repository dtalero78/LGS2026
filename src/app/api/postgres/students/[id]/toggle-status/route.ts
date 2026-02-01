import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/students/[id]/toggle-status
 *
 * Toggle student's contract status (activate/deactivate)
 *
 * Body:
 * - active: boolean - true to activate, false to deactivate
 * - motivo: string (optional) - Reason for status change
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
    const { active, motivo } = body;

    if (active === undefined) {
      return NextResponse.json(
        { error: 'active (boolean) is required' },
        { status: 400 }
      );
    }

    // Get student
    const studentResult = await query(
      `SELECT "_id", "numeroId", "estadoInactivo", "primerNombre", "primerApellido"
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
    const newStatus = !active; // estadoInactivo is inverted from active

    // Don't update if status is already the same
    if (student.estadoInactivo === newStatus) {
      return NextResponse.json({
        success: true,
        message: `Student is already ${active ? 'active' : 'inactive'}`,
        student,
        statusChanged: false,
      });
    }

    // Update status
    const updateResult = await query(
      `UPDATE "PEOPLE"
       SET "estadoInactivo" = $1,
           "_updatedDate" = NOW()
       WHERE "_id" = $2
       RETURNING *`,
      [newStatus, student._id]
    );

    // Optionally log the status change (if you have a status history table)
    // For now, we'll just return the result

    return NextResponse.json({
      success: true,
      message: `Student ${active ? 'activated' : 'deactivated'} successfully`,
      student: updateResult.rows[0],
      statusChanged: true,
      previousStatus: !newStatus,
      newStatus: newStatus,
      motivo: motivo || null,
    });
  } catch (error: any) {
    console.error('❌ Error toggling student status:', error);
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
 * GET /api/postgres/students/[id]/toggle-status
 *
 * Get student's current contract status
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

    // Get student status
    const studentResult = await query(
      `SELECT "_id", "numeroId", "estadoInactivo", "primerNombre", "primerApellido"
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

    return NextResponse.json({
      success: true,
      student: {
        _id: student._id,
        numeroId: student.numeroId,
        nombre: `${student.primerNombre} ${student.primerApellido}`,
        estadoInactivo: student.estadoInactivo,
        active: !student.estadoInactivo,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching student status:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
