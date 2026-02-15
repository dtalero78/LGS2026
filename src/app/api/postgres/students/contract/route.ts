import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { extendByDays, extendToDate } from '@/services/contract.service';
import { ValidationError } from '@/lib/errors';

/**
 * PUT /api/postgres/students/contract
 *
 * Manually extend student contract by days or to a specific date.
 */
export const PUT = handlerWithAuth(async (request, { session }) => {
  const body = await request.json();

  if (!body.studentId) throw new ValidationError('studentId is required');
  if (!body.motivo) throw new ValidationError('motivo is required');
  if (!body.diasExtendidos && !body.nuevaFecha) {
    throw new ValidationError('Either diasExtendidos or nuevaFecha is required');
  }
  if (body.diasExtendidos && body.nuevaFecha) {
    throw new ValidationError('Provide either diasExtendidos OR nuevaFecha, not both');
  }

  const ejecutadoPor = session.user?.name || session.user?.email || 'Unknown';
  const ejecutadoPorEmail = session.user?.email || '';

  if (body.diasExtendidos) {
    const result = await extendByDays({
      studentId: body.studentId,
      diasExtension: body.diasExtendidos,
      motivo: body.motivo,
      ejecutadoPor,
      ejecutadoPorEmail,
    });

    return successResponse({
      student: result.student,
      message: `Contrato extendido exitosamente por ${body.diasExtendidos} días`,
      extension: result.extension,
      extensionEntry: result.extensionEntry,
    });
  }

  const result = await extendToDate({
    studentId: body.studentId,
    nuevaFecha: body.nuevaFecha,
    motivo: body.motivo,
    ejecutadoPor,
    ejecutadoPorEmail,
  });

  return successResponse({
    student: result.student,
    message: `Contrato extendido exitosamente`,
    extension: result.extension,
    extensionEntry: result.extensionEntry,
  });
});
