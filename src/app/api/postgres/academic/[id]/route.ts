import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * PUT /api/postgres/academic/[id]
 *
 * Update a class record (ACADEMICA_BOOKINGS)
 *
 * [id] is the booking ID (_id)
 *
 * Body: Any fields from ACADEMICA_BOOKINGS to update:
 * - asistio: boolean
 * - asistencia: boolean
 * - participacion: boolean
 * - evaluacion: number (1-5)
 * - comentarios: string
 * - noAprobo: boolean
 * - cancelo: boolean
 * - comentarioAdvisor: string
 * - comentarioEstudiante: string
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

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Allowed fields to update
    const allowedFields = [
      'asistio',
      'asistencia',
      'participacion',
      'evaluacion',
      'comentarios',
      'noAprobo',
      'cancelo',
      'comentarioAdvisor',
      'comentarioEstudiante',
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

    // Add booking ID as last parameter
    values.push(params.id);

    const result = await query(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Class record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Class record updated successfully',
      booking: result.rows[0],
      updated: updates.length - 1, // Exclude _updatedDate from count
    });
  } catch (error: any) {
    console.error('❌ Error updating class record:', error);
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
 * GET /api/postgres/academic/[id]
 *
 * Get a single class record (ACADEMICA_BOOKINGS) by ID
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

    const result = await query(
      `SELECT * FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1`,
      [params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Class record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: result.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error fetching class record:', error);
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
 * DELETE /api/postgres/academic/[id]
 *
 * Delete a class record (ACADEMICA_BOOKINGS)
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

    // Get booking details before deletion
    const bookingResult = await query(
      `SELECT "eventoId", "idEvento" FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1`,
      [params.id]
    );

    if (bookingResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Class record not found' },
        { status: 404 }
      );
    }

    const booking = bookingResult.rows[0];
    const eventoId = booking.eventoId || booking.idEvento;

    // Delete booking
    await query(
      `DELETE FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1`,
      [params.id]
    );

    // Decrement inscritos count in CALENDARIO if evento exists
    if (eventoId) {
      await query(
        `UPDATE "CALENDARIO"
         SET "inscritos" = GREATEST("inscritos" - 1, 0),
             "_updatedDate" = NOW()
         WHERE "_id" = $1`,
        [eventoId]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Class record deleted successfully',
      deletedId: params.id,
    });
  } catch (error: any) {
    console.error('❌ Error deleting class record:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
