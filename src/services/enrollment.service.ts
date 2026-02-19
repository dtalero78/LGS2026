/**
 * Enrollment Service
 *
 * Business logic for enrolling/unenrolling students in events.
 */

import 'server-only';
import { CalendarioRepository } from '@/repositories/calendar.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

interface EnrollInput {
  eventId: string;
  studentIds: string[];
  agendadoPor?: string;
  agendadoPorEmail?: string;
  agendadoPorRol?: string;
}

/**
 * Enroll multiple students in an event.
 * Checks capacity, creates bookings, and updates inscritos count.
 */
export async function enrollStudents(input: EnrollInput) {
  if (!input.studentIds || input.studentIds.length === 0) {
    throw new ValidationError('At least one studentId is required');
  }

  // Get event and check capacity
  const event = await CalendarioRepository.findByIdWithAdvisor(input.eventId);
  if (!event) throw new NotFoundError('Event', input.eventId);

  if (
    event.limiteUsuarios &&
    event.limiteUsuarios > 0 &&
    event.inscritos >= event.limiteUsuarios
  ) {
    throw new ConflictError('Event is full');
  }

  // Fetch all students - try PEOPLE first with JOIN to ACADEMICA to get canonical ACADEMICA _id.
  // Using ACADEMICA _id is critical: historical bookings use ACADEMICA _id, not PEOPLE _id.
  const { queryMany } = await import('@/lib/postgres');
  let students = await queryMany(
    `SELECT COALESCE(a."_id", p."_id") as "_id",
            COALESCE(p."numeroId", a."numeroId") as "numeroId",
            COALESCE(p."primerNombre", a."primerNombre") as "primerNombre",
            COALESCE(p."primerApellido", a."primerApellido") as "primerApellido",
            p."celular",
            COALESCE(a."nivel", p."nivel") as "nivel",
            COALESCE(a."step", p."step") as "step"
     FROM "PEOPLE" p
     LEFT JOIN "ACADEMICA" a ON a."numeroId" = p."numeroId"
     WHERE p."_id" = ANY($1::text[])`,
    [input.studentIds]
  );

  // If not found in PEOPLE, the IDs might be ACADEMICA IDs - look up via ACADEMICA JOIN PEOPLE
  if (students.length < input.studentIds.length) {
    const foundIds = new Set(students.map((s: any) => s._id));
    const missingIds = input.studentIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      const academicStudents = await queryMany(
        `SELECT a."_id",
                COALESCE(p."numeroId", a."numeroId") as "numeroId",
                COALESCE(p."primerNombre", a."primerNombre") as "primerNombre",
                COALESCE(p."primerApellido", a."primerApellido") as "primerApellido",
                p."celular",
                COALESCE(a."nivel", p."nivel") as "nivel",
                COALESCE(a."step", p."step") as "step"
         FROM "ACADEMICA" a
         LEFT JOIN "PEOPLE" p ON a."numeroId" = p."numeroId"
         WHERE a."_id" = ANY($1::text[])`,
        [missingIds]
      );
      students = [...students, ...academicStudents];
    }
  }

  if (students.length === 0) {
    throw new NotFoundError('Students', input.studentIds.join(', '));
  }

  // Create bookings inside a transaction so INSERT + incrementInscritos are atomic.
  // This prevents "ghost bookings" where INSERT succeeds but incrementInscritos fails.
  const { transaction } = await import('@/lib/postgres');
  const bookings: any[] = [];

  await transaction(async (client) => {
    for (const student of students) {
      // Skip if student already has an active (non-cancelled) booking for this event
      const alreadyEnrolled = await BookingRepository.existsByStudentAndEvent(student._id, input.eventId);
      if (alreadyEnrolled) {
        throw new ConflictError(`El estudiante ya está inscrito en este evento`);
      }
      const bookingData: Record<string, any> = {
        _id: ids.booking(),
        eventoId: input.eventId,
        idEvento: input.eventId,
        studentId: student._id,
        idEstudiante: student._id,
        primerNombre: student.primerNombre,
        primerApellido: student.primerApellido,
        numeroId: student.numeroId,
        celular: student.celular,
        nivel: event.nivel || event.tituloONivel || student.nivel,
        step: event.step || event.nombreEvento || student.step,
        advisor: event.advisor,
        fecha: event.dia,
        fechaEvento: event.dia,
        hora: event.hora,
        tipo: event.tipo || event.evento,
        tipoEvento: event.tipo || event.evento,
        linkZoom: event.linkZoom,
        nombreEvento: event.nombreEvento || event.titulo,
        tituloONivel: event.tituloONivel,
        asistio: false,
        asistencia: false,
        participacion: false,
        noAprobo: false,
        cancelo: false,
        agendadoPor: input.agendadoPor || '',
        agendadoPorEmail: input.agendadoPorEmail || '',
        agendadoPorRol: input.agendadoPorRol || '',
        origen: 'POSTGRES',
      };

      const columns = Object.keys(bookingData);
      const values = Object.values(bookingData);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnList = columns.map((c) => `"${c}"`).join(', ');
      const result = await client.query(
        `INSERT INTO "ACADEMICA_BOOKINGS" (${columnList}, "_createdDate", "_updatedDate")
         VALUES (${placeholders}, NOW(), NOW())
         RETURNING *`,
        values
      );
      if (result.rows[0]) bookings.push(result.rows[0]);
    }

    if (bookings.length > 0) {
      await client.query(
        `UPDATE "CALENDARIO" SET "inscritos" = "inscritos" + $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
        [bookings.length, input.eventId]
      );
    }
  });

  return {
    bookings,
    enrolled: bookings.length,
  };
}

/**
 * Unenroll a student from an event.
 */
export async function unenrollStudent(bookingId: string, eventId: string) {
  const deleted = await BookingRepository.deleteEnrollment(bookingId);
  if (!deleted) throw new NotFoundError('Booking', bookingId);

  await CalendarioRepository.decrementInscritos(eventId);
  return { deleted: true };
}
