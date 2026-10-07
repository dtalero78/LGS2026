import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { toggleStatus } from '@/services/student.service';
import { PeopleRepository } from '@/repositories/people.repository';
import { ValidationError } from '@/lib/errors';
import { previewInactivacion } from '@/lib/suspension-beneficiario';

/**
 * POST /api/postgres/students/[id]/toggle-status
 *
 * Toggle administrative suspension of a person (titular or beneficiary).
 *
 * Body: { active: boolean, motivo: string }
 *
 * `motivo` is required for both INACTIVACION and REACTIVACION — it is
 * persisted in PEOPLE.suspenddata along with the executor's email taken
 * from the NextAuth session. The body cannot spoof `realizadoPor`.
 *
 * suspendcount increments only on INACTIVACION. Los efectos (clases futuras,
 * login, KIDS) los aplica toggleStatus → src/lib/suspension-beneficiario.ts y
 * vuelven en `efectos`.
 *
 * Solo staff con PERSON.ADMIN.ACTIVAR_DESACTIVAR (antes bastaba cualquier
 * sesión, incluida una cuenta ESTUDIANTE).
 */
export const POST = handlerWithStaffAuth(async (request, { params }, session) => {
  await requirePermission(session, PersonPermission.ACTIVAR_DESACTIVAR);
  const body = await request.json().catch(() => ({}));
  const { active, motivo } = body;

  if (active === undefined) throw new ValidationError('active (boolean) is required');
  if (typeof motivo !== 'string' || !motivo.trim()) {
    throw new ValidationError('motivo (texto) es obligatorio');
  }

  const realizadoPor = (session?.user as any)?.email || 'unknown';
  const realizadoPorNombre = (session?.user as any)?.name || undefined;

  const result = await toggleStatus(params.id, active, {
    motivo: motivo.trim(),
    realizadoPor,
    realizadoPorNombre,
  });

  return successResponse({
    message: result.statusChanged
      ? `Student ${active ? 'activated' : 'deactivated'} successfully`
      : `Student is already ${active ? 'active' : 'inactive'}`,
    student: result.student,
    statusChanged: result.statusChanged,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    suspenddata: result.suspenddata ?? null,
    efectos: (result as any).efectos ?? null,
  });
});

/**
 * GET /api/postgres/students/[id]/toggle-status
 *
 * Estado actual + vista previa de lo que pasaría al inactivar (clases futuras a
 * cancelar, correo compartido, kid) para el modal de confirmación.
 */
export const GET = handlerWithStaffAuth(async (request, { params }) => {
  const person = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);

  return successResponse({
    student: {
      _id: person._id,
      numeroId: person.numeroId,
      nombre: `${person.primerNombre} ${person.primerApellido}`,
      estadoInactivo: person.estadoInactivo,
      active: !person.estadoInactivo,
      suspenddata: person.suspenddata ?? null,
      suspendcount: person.suspendcount ?? 0,
    },
    preview: person.estadoInactivo ? null : await previewInactivacion(person),
  });
});
