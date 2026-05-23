import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { toggleStatus } from '@/services/student.service';
import { PeopleRepository } from '@/repositories/people.repository';
import { ValidationError } from '@/lib/errors';

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
 * suspendcount increments only on INACTIVACION.
 */
export const POST = handlerWithAuth(async (request, { params }, session) => {
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
  });
});

/**
 * GET /api/postgres/students/[id]/toggle-status
 *
 * Get student's current status
 */
export const GET = handlerWithAuth(async (request, { params }) => {
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
  });
});
