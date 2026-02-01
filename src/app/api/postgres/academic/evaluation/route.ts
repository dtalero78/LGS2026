import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * PUT /api/postgres/academic/evaluation
 *
 * Save evaluation for a student in a class
 *
 * Body:
 * {
 *   bookingId: string,              // _id of ACADEMICA_BOOKINGS record
 *   calificacion?: number,          // Rating/score (1-5 or custom scale)
 *   advisorAnotaciones?: string,    // Advisor/teacher comments
 *   comentarios?: string,           // Student comments
 *   participacion?: boolean,        // Student participation
 *   actividadPropuesta?: string,    // Proposed activity
 *   noAprobo?: boolean              // Did not pass
 * }
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
    if (!body.bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
        { status: 400 }
      );
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Allowed fields to update
    const allowedFields = [
      'calificacion',
      'advisorAnotaciones',
      'comentarios',
      'participacion',
      'actividadPropuesta',
      'noAprobo',
      'anotaciones'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add _updatedDate
    updates.push(`"_updatedDate" = NOW()`);

    // Add bookingId as last parameter
    values.push(body.bookingId);

    const result = await query(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const booking = result.rows[0];

    return NextResponse.json({
      success: true,
      booking,
      updated: updates.length - 1, // Exclude _updatedDate from count
    });
  } catch (error: any) {
    console.error('❌ Error saving evaluation:', error);
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
 * POST /api/postgres/academic/evaluation
 *
 * Create or update evaluation with attendance (combined operation)
 *
 * Body:
 * {
 *   bookingId: string,
 *   asistio: boolean,
 *   calificacion?: number,
 *   advisorAnotaciones?: string,
 *   comentarios?: string,
 *   participacion?: boolean,
 *   actividadPropuesta?: string
 * }
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
    if (!body.bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
        { status: 400 }
      );
    }

    // Build dynamic UPDATE query with attendance
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Always include attendance if provided
    if (body.asistio !== undefined) {
      updates.push(`"asistio" = $${paramIndex}`);
      values.push(body.asistio);
      paramIndex++;

      updates.push(`"asistencia" = $${paramIndex}`);
      values.push(body.asistio);
      paramIndex++;
    }

    // Allowed evaluation fields
    const allowedFields = [
      'calificacion',
      'advisorAnotaciones',
      'comentarios',
      'participacion',
      'actividadPropuesta',
      'noAprobo',
      'anotaciones'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add timestamps
    updates.push(`"fecha" = NOW()`);
    updates.push(`"_updatedDate" = NOW()`);

    // Add bookingId as last parameter
    values.push(body.bookingId);

    const result = await query(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const booking = result.rows[0];

    return NextResponse.json({
      success: true,
      booking,
      updated: updates.length - 2, // Exclude timestamps from count
      message: 'Evaluación y asistencia guardadas',
    });
  } catch (error: any) {
    console.error('❌ Error saving evaluation with attendance:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
