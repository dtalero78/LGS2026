import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { PeopleRepository } from '@/repositories/people.repository';
import { StepOverridesRepository } from '@/repositories/niveles.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

/**
 * POST /api/postgres/students/[id]/step-override
 *
 * Mark a step as completed (override) for a student.
 */
export const POST = handlerWithAuth(async (request, { params, session }) => {
  const body = await request.json();
  const { step, completado, nivel: nivelFromBody } = body;

  if (!step) throw new ValidationError('step is required');

  const student = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);
  const existing = await StepOverridesRepository.findByStudentAndStep(student._id, step);

  if (existing) {
    const override = await StepOverridesRepository.update(existing._id, completado);
    return successResponse({ message: `Override actualizado para ${step}`, override });
  }

  const override = await StepOverridesRepository.create({
    _id: ids.override(),
    studentId: student._id,
    nivel: student.nivel || nivelFromBody || '',
    step,
    isCompleted: completado,
  });

  return successResponse({ message: `Override creado para ${step}`, override });
});

/**
 * DELETE /api/postgres/students/[id]/step-override
 */
export const DELETE = handlerWithAuth(async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step');

  if (!step) throw new ValidationError('step query parameter is required');

  const student = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);
  const deleted = await StepOverridesRepository.deleteByStudentAndStep(student._id, step);

  if (!deleted) throw new NotFoundError('Override', `${params.id}/${step}`);

  return successResponse({ message: `Override eliminado para ${step}` });
});

/**
 * GET /api/postgres/students/[id]/step-override
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step');

  const student = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);

  if (step) {
    const override = await StepOverridesRepository.findByStudentAndStep(student._id, step);
    return successResponse({ overrides: override ? [override] : [], count: override ? 1 : 0 });
  }

  const overrides = await StepOverridesRepository.findByStudentId(student._id);
  return successResponse({ overrides, count: overrides.length });
});
