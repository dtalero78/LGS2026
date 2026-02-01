import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/academic/attendance
 *
 * Mark student attendance for a class/event
 *
 * Body:
 * {
 *   bookingId: string,      // _id of ACADEMICA_BOOKINGS record
 *   asistio: boolean,       // true = attended, false = absent
 *   fecha?: string          // Optional: attendance date (defaults to NOW)
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

    if (body.asistio === undefined) {
      return NextResponse.json(
        { error: 'asistio is required' },
        { status: 400 }
      );
    }

    // Update attendance
    const result = await query(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET "asistio" = $1,
           "asistencia" = $1,
           "fecha" = COALESCE($2::timestamp with time zone, NOW()),
           "_updatedDate" = NOW()
       WHERE "_id" = $3
       RETURNING *`,
      [body.asistio, body.fecha || null, body.bookingId]
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
      message: booking.asistio ? 'Asistencia marcada' : 'Ausencia marcada',
    });
  } catch (error: any) {
    console.error('❌ Error marking attendance:', error);
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
 * PUT /api/postgres/academic/attendance
 *
 * Update attendance for multiple students at once (bulk update)
 *
 * Body:
 * {
 *   bookings: [
 *     { bookingId: string, asistio: boolean },
 *     { bookingId: string, asistio: boolean },
 *     ...
 *   ]
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
    if (!body.bookings || !Array.isArray(body.bookings)) {
      return NextResponse.json(
        { error: 'bookings array is required' },
        { status: 400 }
      );
    }

    if (body.bookings.length === 0) {
      return NextResponse.json(
        { error: 'bookings array cannot be empty' },
        { status: 400 }
      );
    }

    // Update attendance for each booking
    const results = [];
    for (const booking of body.bookings) {
      if (!booking.bookingId || booking.asistio === undefined) {
        continue; // Skip invalid entries
      }

      const result = await query(
        `UPDATE "ACADEMICA_BOOKINGS"
         SET "asistio" = $1,
             "asistencia" = $1,
             "fecha" = NOW(),
             "_updatedDate" = NOW()
         WHERE "_id" = $2
         RETURNING "_id", "asistio", "primerNombre", "primerApellido"`,
        [booking.asistio, booking.bookingId]
      );

      if (result.rowCount > 0) {
        results.push(result.rows[0]);
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      bookings: results,
    });
  } catch (error: any) {
    console.error('❌ Error bulk updating attendance:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
