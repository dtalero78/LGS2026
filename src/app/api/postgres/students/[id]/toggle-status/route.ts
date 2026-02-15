import { handlerWithAuth, handler, successResponse } from '@/lib/api-helpers';
import { toggleStatus } from '@/services/student.service';
import { PeopleRepository } from '@/repositories/people.repository';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/students/[id]/toggle-status
 *
 * Toggle student active/inactive status
 */
export const POST = handlerWithAuth(async (request, { params }) => {
  const body = await request.json();
  const { active, motivo } = body;

  if (active === undefined) throw new ValidationError('active (boolean) is required');

  const result = await toggleStatus(params.id, active);

  return successResponse({
    message: result.statusChanged
      ? `Student ${active ? 'activated' : 'deactivated'} successfully`
      : `Student is already ${active ? 'active' : 'inactive'}`,
    student: result.student,
    statusChanged: result.statusChanged,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    motivo: motivo || null,
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
    },
  });
});
