import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { changeStep } from '@/services/student.service';
import { ValidationError } from '@/lib/errors';
import { personaDeFichaAcademica, registrarEventoContrato } from '@/lib/contrato-eventos';

/**
 * PUT /api/postgres/students/[id]/step
 *
 * Update student's step (regular or parallel level).
 */
export const PUT = handlerWithAuth(async (request, { params }, session) => {
  const body = await request.json();
  const { newStep } = body;

  if (!newStep) throw new ValidationError('newStep is required');

  const result = await changeStep(params.id, `Step ${newStep}`);

  const personaId = await personaDeFichaAcademica(params.id);
  if (personaId) {
    const nivel = result.updatedFields.nivel || result.updatedFields.nivelParalelo;
    const step = result.updatedFields.step || result.updatedFields.stepParalelo;
    await registrarEventoContrato({ personaId, categoria: 'ACADEMICO', accion: 'Cambio de step', detalle: `${nivel} - ${step}`, session });
  }

  return successResponse({
    message: `Step actualizado exitosamente a ${result.updatedFields.nivel || result.updatedFields.nivelParalelo} - ${result.updatedFields.step || result.updatedFields.stepParalelo}`,
    student: result.student,
    isParallel: result.isParallel,
    updatedFields: result.updatedFields,
  });
});
