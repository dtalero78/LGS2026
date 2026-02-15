import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

/**
 * POST /api/postgres/academic/user
 *
 * Create or update an academic record for a student.
 */
export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();
  const { studentId, nivel, step, advisor, plataforma } = body;

  if (!studentId || !nivel || !step) {
    throw new ValidationError('studentId, nivel, and step are required');
  }

  const student = await PeopleRepository.findByIdOrNumeroIdOrThrow(studentId);

  // Check if academic record already exists
  const existing = await AcademicaRepository.findByNumeroId(student.numeroId);

  if (existing) {
    await AcademicaRepository.updateStep(student.numeroId, nivel, step, false);
    const updated = await AcademicaRepository.findByNumeroId(student.numeroId);

    return successResponse({
      message: 'Academic record updated',
      academica: updated,
    });
  }

  const academica = await AcademicaRepository.create({
    _id: ids.academic(),
    numeroId: student.numeroId,
    primerNombre: student.primerNombre,
    segundoNombre: student.segundoNombre,
    primerApellido: student.primerApellido,
    segundoApellido: student.segundoApellido,
    email: student.email,
    celular: student.celular,
    nivel,
    step,
    advisor: advisor || null,
    plataforma: plataforma || null,
  });

  return successResponse({
    message: 'Academic record created',
    academica,
  });
});
