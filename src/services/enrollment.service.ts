/**
 * Enrollment Service
 *
 * Business logic for enrolling/unenrolling students in events.
 */

import 'server-only';
import { CalendarioRepository } from '@/repositories/calendar.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { PeopleRepository } from '@/repositories/people.repository';
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

  // Fetch all students in one batch
  const { queryMany } = await import('@/lib/postgres');
  const students = await queryMany(
    `SELECT "_id", "numeroId", "primerNombre", "primerApellido", "celular", "nivel", "step"
     FROM "PEOPLE" WHERE "_id" = ANY($1::text[])`,
    [input.studentIds]
  );

  if (students.length === 0) {
    throw new NotFoundError('Students', input.studentIds.join(', '));
  }

  // Create bookings
  const bookings = [];
  for (const student of students) {
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
      nivel: student.nivel || event.nivel || event.tituloONivel,
      step: student.step || event.step || event.nombreEvento,
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

    const booking = await BookingRepository.createEnrollment(bookingData);
    if (booking) bookings.push(booking);
  }

  // Update event inscritos count
  if (bookings.length > 0) {
    await CalendarioRepository.incrementInscritos(input.eventId, bookings.length);
  }

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
