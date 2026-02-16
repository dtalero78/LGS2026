import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { cancelBooking } from '@/services/student-booking.service';
import { ValidationError } from '@/lib/errors';

export const POST = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);

  const body = await request.json();
  const { bookingId } = body;
  if (!bookingId) throw new ValidationError('bookingId es requerido');

  const result = await cancelBooking(student._id, bookingId);
  return successResponse(result);
});
