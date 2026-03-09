import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { BookingRepository } from '@/repositories/booking.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { autoAdvanceStep } from '@/services/student.service';

const UPDATABLE_FIELDS = [
  'asistio', 'asistencia', 'participacion', 'noAprobo',
  'calificacion', 'comentarios', 'advisorAnotaciones', 'actividadPropuesta',
];

/**
 * POST /api/postgres/academic-record
 *
 * Save evaluation for a student booking by idEstudiante + idEvento.
 * Used by the session detail page (SessionStudentsTab).
 */
export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();

  const { idEstudiante, idEvento, asistencia, participacion, noAprobo, calificacion, comentarios, advisorAnotaciones, actividadPropuesta } = body;

  if (!idEstudiante || !idEvento) {
    throw new ValidationError('idEstudiante and idEvento are required');
  }

  // Find the booking by student + event
  const booking = await BookingRepository.findByStudentAndEvent(idEstudiante, idEvento);
  if (!booking) {
    throw new NotFoundError('Booking', `student=${idEstudiante}, event=${idEvento}`);
  }

  // Map text calificacion to integer (column is integer 0-10)
  const calificacionMap: Record<string, number> = {
    'Excelente': 10,
    'Muy Bien': 8,
    'Bien': 6,
    'Regular': 4,
    'Necesita Mejorar': 2,
  };

  // Build update data
  const updateData: Record<string, any> = {};
  if (asistencia !== undefined) {
    updateData.asistio = asistencia;
    updateData.asistencia = asistencia;
  }
  if (participacion !== undefined) updateData.participacion = participacion;
  if (noAprobo !== undefined) updateData.noAprobo = noAprobo;
  if (calificacion !== undefined && calificacion !== '') {
    const mapped = typeof calificacion === 'string' ? calificacionMap[calificacion] : undefined;
    updateData.calificacion = mapped !== undefined ? mapped : (parseInt(calificacion) || 0);
  }
  if (comentarios !== undefined) updateData.comentarios = comentarios;
  if (advisorAnotaciones !== undefined) updateData.advisorAnotaciones = advisorAnotaciones;
  if (actividadPropuesta !== undefined) updateData.actividadPropuesta = actividadPropuesta;

  const updated = await BookingRepository.updateFields(booking._id, updateData, UPDATABLE_FIELDS);
  if (!updated) {
    throw new NotFoundError('Booking', booking._id);
  }

  const advancement = await autoAdvanceStep(booking._id);

  return successResponse({
    booking: updated,
    advancement,
    message: 'Evaluación guardada exitosamente',
  });
});
