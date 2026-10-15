import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { StudentPermission } from '@/types/permissions';
import { activateOnHold, deactivateOnHold } from '@/services/contract.service';
import { ValidationError } from '@/lib/errors';
import { textoKids } from '@/lib/kids-onhold';

/**
 * POST /api/postgres/students/onhold
 *
 * Activate or deactivate OnHold status for a student.
 * When deactivating, automatically extends the contract by the paused days.
 * Beneficiarios Kids: el mismo OnHold se aplica en KIDS2026 (src/lib/kids-onhold.ts).
 * Solo staff con STUDENT.ACADEMIA.ACTIVAR_HOLD (antes bastaba cualquier sesión).
 */
export const POST = handlerWithStaffAuth(async (request, context, session) => {
  await requirePermission(session, StudentPermission.ACTIVAR_HOLD);
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
      message: `OnHold activado exitosamente.${textoKids(result.kids)}`,
      onHoldEntry: result.onHoldEntry,
      kids: result.kids,
    });
  }

  const result = await deactivateOnHold(body.studentId);

  return successResponse({
    student: result.student,
    message: `OnHold desactivado y contrato extendido ${result.extension.daysPaused} días automáticamente.${textoKids(result.kids)}`,
    extension: result.extension,
    kids: result.kids,
  });
});
