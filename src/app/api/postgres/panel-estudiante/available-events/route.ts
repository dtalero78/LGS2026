import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { getAvailableEvents } from '@/services/student-booking.service';
import { ValidationError } from '@/lib/errors';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) throw new ValidationError('El parámetro "date" es requerido');

  const tipo = searchParams.get('tipo') || undefined;
  const nivel = student.nivel || '';
  const step = student.step || '';

  const bookingId = student.academicaId || student._id;
  const peopleId = student._id; // PEOPLE _id for step overrides lookup
  const events = await getAvailableEvents(bookingId, peopleId, nivel, step, date, tipo);
  return successResponse({ events });
});
