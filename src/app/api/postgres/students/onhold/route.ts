import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { activateOnHold, deactivateOnHold } from '@/services/contract.service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/students/onhold
 *
 * Activate or deactivate OnHold status for a student.
 * When deactivating, automatically extends the contract by the paused days.
 */
export const POST = handlerWithAuth(async (request, { session }) => {
  const body = await request.json();

  if (!body.studentId) throw new ValidationError('studentId is required');
  if (body.setOnHold === undefined) throw new ValidationError('setOnHold is required');

  if (body.setOnHold) {
    if (!body.fechaOnHold || !body.fechaFinOnHold) {
      throw new ValidationError('fechaOnHold and fechaFinOnHold are required when activating OnHold');
    }

    const result = await activateOnHold({
      studentId: body.studentId,
      fechaOnHold: body.fechaOnHold,
      fechaFinOnHold: body.fechaFinOnHold,
      motivo: body.motivo,
      activadoPor: session.user?.name || session.user?.email || 'Unknown',
    });

    return successResponse({
      student: result.student,
      message: 'OnHold activado exitosamente',
      onHoldEntry: result.onHoldEntry,
    });
  }

  const result = await deactivateOnHold(body.studentId);

  return successResponse({
    student: result.student,
    message: 'OnHold desactivado y contrato extendido automáticamente',
    extension: result.extension,
    extensionEntry: result.extensionEntry,
  });
});
