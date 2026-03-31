import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { StepOverridesRepository } from '@/repositories/niveles.repository';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

/**
 * Resolves the canonical ACADEMICA _id for a student.
 * Throws ConflictError if the student has duplicate records in ACADEMICA.
 * Throws NotFoundError if not found.
 */
async function resolveAcademicaId(paramsId: string): Promise<{ academicaId: string; nivel: string }> {
  // Try direct ACADEMICA lookup first (_id, studentId, peopleId, or numeroId)
  const record = await AcademicaRepository.findByAnyId(paramsId);
  if (!record) throw new NotFoundError('Registro académico', paramsId);

  // Check for duplicates using the resolved numeroId
  if (record.numeroId) {
    const duplicates = await AcademicaRepository.findManyByNumeroId(record.numeroId);
    if (duplicates.length > 1) {
      throw new ConflictError(`USUARIO duplicado en ACADEMICA (${duplicates.length} registros con numeroId ${record.numeroId})`);
    }
  }

  return { academicaId: record._id, nivel: record.nivel || '' };
}

/**
 * POST /api/postgres/students/[id]/step-override
 *
 * Mark a step as completed/incomplete (override) for a student.
 * Uses ACADEMICA _id as studentId in STEP_OVERRIDES.
 */
export const POST = handlerWithAuth(async (request, { params }, session) => {
  const body = await request.json();
  const { step, completado, nivel: nivelFromBody } = body;

  if (!step) throw new ValidationError('step is required');

  const { academicaId, nivel } = await resolveAcademicaId(params.id);
  const existing = await StepOverridesRepository.findByStudentAndStep(academicaId, step);

  if (existing) {
    const override = await StepOverridesRepository.update(existing._id, completado);
    return successResponse({ message: `Override actualizado para ${step}`, override });
  }

  const override = await StepOverridesRepository.create({
    _id: ids.override(),
    studentId: academicaId,
    nivel: nivel || nivelFromBody || '',
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

  const { academicaId } = await resolveAcademicaId(params.id);
  const deleted = await StepOverridesRepository.deleteByStudentAndStep(academicaId, step);

  if (!deleted) throw new NotFoundError('Override', `${params.id}/${step}`);

  return successResponse({ message: `Override eliminado para ${step}` });
});

/**
 * GET /api/postgres/students/[id]/step-override
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step');

  const { academicaId } = await resolveAcademicaId(params.id);

  if (step) {
    const override = await StepOverridesRepository.findByStudentAndStep(academicaId, step);
    return successResponse({ overrides: override ? [override] : [], count: override ? 1 : 0 });
  }

  const overrides = await StepOverridesRepository.findByStudentId(academicaId);
  return successResponse({ overrides, count: overrides.length });
});
