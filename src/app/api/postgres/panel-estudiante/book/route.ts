import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { bookEvent } from '@/services/student-booking.service';
import { ValidationError } from '@/lib/errors';

export const POST = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);

  const body = await request.json();
  const { eventId } = body;
  if (!eventId) throw new ValidationError('eventId es requerido');

  const booking = await bookEvent(
    student._id,
    {
      primerNombre: student.primerNombre || '',
      primerApellido: student.primerApellido || '',
      numeroId: student.numeroId || '',
      celular: student.celular || '',
      nivel: student.nivel,
      step: student.step,
    },
    eventId
  );

  return successResponse({ booking }, 201);
});
