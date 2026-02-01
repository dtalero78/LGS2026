import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * DELETE /api/postgres/events/[id]/enroll/[bookingId]
 *
 * Unenroll student from an event (delete booking)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; bookingId: string } }
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

    // Check if booking exists
    const bookingCheck = await query(
      `SELECT "_id", "eventoId", "idEvento", "primerNombre", "primerApellido"
       FROM "ACADEMICA_BOOKINGS"
       WHERE "_id" = $1`,
      [params.bookingId]
    );

    if (bookingCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const booking = bookingCheck.rows[0];

    // Verify booking belongs to this event
    if (booking.eventoId !== params.id && booking.idEvento !== params.id) {
      return NextResponse.json(
        { error: 'Booking does not belong to this event' },
        { status: 400 }
      );
    }

    // Delete booking
    await query(
      `DELETE FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1`,
      [params.bookingId]
    );

    // Decrement inscritos count
    await query(
      `UPDATE "CALENDARIO"
       SET "inscritos" = GREATEST("inscritos" - 1, 0),
           "_updatedDate" = NOW()
       WHERE "_id" = $1`,
      [params.id]
    );

    return NextResponse.json({
      success: true,
      message: `${booking.primerNombre} ${booking.primerApellido} desinscrito exitosamente`,
      bookingId: params.bookingId,
    });
  } catch (error: any) {
    console.error('❌ Error unenrolling student:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
