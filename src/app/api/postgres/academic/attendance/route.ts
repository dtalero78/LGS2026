import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { BookingRepository } from '@/repositories/booking.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';

/**
 * POST /api/postgres/academic/attendance
 *
 * Mark single student attendance.
 */
export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();

  if (!body.bookingId) throw new ValidationError('bookingId is required');
  if (body.asistio === undefined) throw new ValidationError('asistio is required');

  const booking = await BookingRepository.markAttendance(body.bookingId, body.asistio, body.fecha);
  if (!booking) throw new NotFoundError('Booking', body.bookingId);

  return successResponse({
    booking,
    message: booking.asistio ? 'Asistencia marcada' : 'Ausencia marcada',
  });
});

/**
 * PUT /api/postgres/academic/attendance
 *
 * Bulk attendance update.
 */
export const PUT = handlerWithAuth(async (request) => {
  const body = await request.json();

  if (!body.bookings || !Array.isArray(body.bookings) || body.bookings.length === 0) {
    throw new ValidationError('bookings array is required and cannot be empty');
  }

  const results = await BookingRepository.markAttendanceBulk(body.bookings);

  return successResponse({
    updated: results.length,
    bookings: results,
  });
});
