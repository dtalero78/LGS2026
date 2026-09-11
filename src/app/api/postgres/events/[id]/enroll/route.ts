import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { StudentPermission } from '@/types/permissions';
import { enrollStudents } from '@/services/enrollment.service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/events/[id]/enroll
 *
 * Enroll student(s) in an event.
 *
 * Lo usan DOS flujos: el wizard "Agendar Sesión" de /student/[id] y la
 * inscripción masiva desde el calendario (agenda-sesiones). Ambos quedan
 * gateados por AGENDAR_CLASE — verificado que todos los roles con
 * ACADEMICO.AGENDA.CALENDARIO_VER también tienen AGENDAR_CLASE, así que el
 * bulk-enroll no se rompe. SUPER_ADMIN/ADMIN bypasean.
 */
export const POST = handlerWithAuth(async (request, { params }, session) => {
  await requirePermission(session, StudentPermission.AGENDAR_CLASE);

  const body = await request.json();

  if (!body.studentIds || !Array.isArray(body.studentIds) || body.studentIds.length === 0) {
    throw new ValidationError('studentIds array is required and cannot be empty');
  }

  const result = await enrollStudents({
    eventId: params.id,
    studentIds: body.studentIds,
    agendadoPor: body.agendadoPor || session?.user?.name || undefined,
    agendadoPorEmail: body.agendadoPorEmail || session?.user?.email || undefined,
    agendadoPorRol: body.agendadoPorRol || (session?.user as any)?.role || undefined,
    // sessionRole NUNCA viene del body — solo de la sesión autenticada.
    // Se usa para validar bypass de estudiantes INACTIVOS (solo SUPER_ADMIN).
    sessionRole: (session?.user as any)?.role || undefined,
  });

  return successResponse({
    bookings: result.bookings,
    enrolled: result.enrolled,
    message: `${result.enrolled} estudiante(s) inscrito(s) exitosamente`,
  });
});
