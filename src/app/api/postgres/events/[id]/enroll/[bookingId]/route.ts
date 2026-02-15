import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { unenrollStudent } from '@/services/enrollment.service';

/**
 * DELETE /api/postgres/events/[id]/enroll/[bookingId]
 *
 * Unenroll a student from an event (delete booking).
 */
export const DELETE = handlerWithAuth(async (request, { params }) => {
  await unenrollStudent(params.bookingId, params.id);

  return successResponse({
    message: 'Estudiante desinscrito exitosamente',
    bookingId: params.bookingId,
  });
});
