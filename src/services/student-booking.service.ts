/**
 * Student Booking Service
 *
 * Business logic for student self-booking: browse available events,
 * book with capacity/weekly-limit/same-day checks, and cancel.
 */

import 'server-only';
import { CalendarioRepository } from '@/repositories/calendar.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { ValidationError, ConflictError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

const WEEKLY_SESSION_LIMIT = 2;
const WEEKLY_CLUB_LIMIT = 3;
const CANCEL_DEADLINE_MINUTES = 60;

/**
 * Get events available for a student to book.
 * Filters by date range, nivel, tipo, and annotates each event with
 * capacity status and whether the student is already enrolled.
 */
export async function getAvailableEvents(
  studentId: string,
  nivel: string,
  step: string,
  date: string,
  tipo?: string
) {
  // Build a date range for the selected day
  const startDate = `${date}T00:00:00`;
  const endDate = `${date}T23:59:59`;

  const events = await CalendarioRepository.findEvents({
    startDate,
    endDate,
    nivel,
    tipo,
  });

  // Get student's upcoming bookings to check for duplicates
  const upcoming = await BookingRepository.findUpcomingByStudentId(studentId, 100);
  const enrolledEventIds = new Set(
    upcoming.map((b: any) => b.eventoId || b.idEvento)
  );

  // Check if student is on a jump step (multiples of 5)
  const stepNum = parseInt(step?.replace(/\D/g, '') || '0', 10);
  const isJumpStep = stepNum > 0 && stepNum % 5 === 0;

  // Annotate events
  const annotated = await Promise.all(
    events.map(async (evt: any) => {
      const activeCount = await CalendarioRepository.countActiveEnrollments(evt._id);
      const cupoLleno = evt.limiteUsuarios > 0 && activeCount >= evt.limiteUsuarios;
      const yaInscrito = enrolledEventIds.has(evt._id);

      // If student is on a jump step, only show jump-compatible events
      // (events for that specific step or events without step restriction)
      const evtStepNum = parseInt(evt.step?.replace(/\D/g, '') || '0', 10);
      const isJumpEvent = evtStepNum > 0 && evtStepNum % 5 === 0;
      if (isJumpStep && evt.step && !isJumpEvent) {
        return null; // Filter out non-jump events for jump students
      }

      return {
        ...evt,
        inscritos: activeCount,
        cupoLleno,
        yaInscrito,
      };
    })
  );

  return annotated.filter(Boolean);
}

/**
 * Book a student into an event with full validation:
 * 1. Event exists and is in the future
 * 2. Capacity not exceeded
 * 3. Not already enrolled
 * 4. Weekly session/club limits not exceeded
 * 5. No duplicate session on the same day
 */
export async function bookEvent(
  studentId: string,
  studentData: {
    primerNombre: string;
    primerApellido: string;
    numeroId: string;
    celular?: string;
    nivel?: string;
    step?: string;
  },
  eventId: string
) {
  // 1. Get event
  const event = await CalendarioRepository.findByIdWithAdvisor(eventId);
  if (!event) throw new NotFoundError('Evento', eventId);

  // 2. Validate future date
  const eventDate = new Date(event.dia);
  if (eventDate <= new Date()) {
    throw new ValidationError('No se puede agendar en un evento pasado');
  }

  // 3. Check capacity using real active enrollment count
  const activeCount = await CalendarioRepository.countActiveEnrollments(eventId);
  if (event.limiteUsuarios && event.limiteUsuarios > 0 && activeCount >= event.limiteUsuarios) {
    throw new ConflictError('El evento está lleno');
  }

  // 4. Check not already enrolled
  const alreadyEnrolled = await BookingRepository.existsByStudentAndEvent(studentId, eventId);
  if (alreadyEnrolled) {
    throw new ConflictError('Ya estás inscrito en este evento');
  }

  // 5. Check weekly limits
  const eventDay = new Date(event.dia);
  const dayOfWeek = eventDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(eventDay);
  weekStart.setDate(eventDay.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weeklyCounts = await BookingRepository.countWeeklyBookingsByType(
    studentId,
    weekStart.toISOString(),
    weekEnd.toISOString()
  );

  const eventTipo = event.tipo || event.evento || '';
  const weeklyMap: Record<string, number> = {};
  for (const row of weeklyCounts) {
    weeklyMap[(row as any).tipo] = (row as any).count;
  }

  if (eventTipo === 'SESSION') {
    const currentSessions = weeklyMap['SESSION'] || 0;
    if (currentSessions >= WEEKLY_SESSION_LIMIT) {
      throw new ConflictError(`Límite semanal alcanzado: máximo ${WEEKLY_SESSION_LIMIT} sesiones por semana`);
    }
  }

  if (eventTipo === 'CLUB') {
    const currentClubs = weeklyMap['CLUB'] || 0;
    if (currentClubs >= WEEKLY_CLUB_LIMIT) {
      throw new ConflictError(`Límite semanal alcanzado: máximo ${WEEKLY_CLUB_LIMIT} clubs por semana`);
    }
  }

  // 6. Check no duplicate session on same day
  if (eventTipo === 'SESSION') {
    const dateStr = eventDay.toISOString().split('T')[0];
    const hasSameDay = await BookingRepository.existsSameDaySession(studentId, dateStr);
    if (hasSameDay) {
      throw new ConflictError('Ya tienes una sesión agendada para este día');
    }
  }

  // 7. Create booking
  const bookingData: Record<string, any> = {
    _id: ids.booking(),
    eventoId: eventId,
    idEvento: eventId,
    studentId: studentId,
    idEstudiante: studentId,
    primerNombre: studentData.primerNombre,
    primerApellido: studentData.primerApellido,
    numeroId: studentData.numeroId,
    celular: studentData.celular || '',
    nivel: studentData.nivel || event.nivel || event.tituloONivel,
    step: studentData.step || event.step,
    advisor: event.advisor,
    fecha: event.dia,
    fechaEvento: event.dia,
    hora: event.hora,
    tipo: eventTipo,
    tipoEvento: eventTipo,
    linkZoom: event.linkZoom,
    nombreEvento: event.nombreEvento || event.titulo,
    tituloONivel: event.tituloONivel || event.nivel,
    asistio: false,
    asistencia: false,
    participacion: false,
    noAprobo: false,
    cancelo: false,
    agendadoPor: studentData.primerNombre + ' ' + studentData.primerApellido,
    agendadoPorEmail: '',
    agendadoPorRol: 'ESTUDIANTE',
    fechaAgendamiento: new Date().toISOString(),
    origen: 'PANEL_ESTUDIANTE',
  };

  const booking = await BookingRepository.createEnrollment(bookingData);

  // 8. Increment inscritos
  await CalendarioRepository.incrementInscritos(eventId);

  return booking;
}

/**
 * Cancel a student's booking (soft cancel).
 * Validates ownership and the 60-minute cancellation deadline.
 */
export async function cancelBooking(studentId: string, bookingId: string) {
  // 1. Find booking
  const booking = await BookingRepository.findBookingById(bookingId);
  if (!booking) throw new NotFoundError('Booking', bookingId);

  // 2. Verify ownership
  if (booking.studentId !== studentId && booking.idEstudiante !== studentId) {
    throw new ForbiddenError('No puedes cancelar un booking que no es tuyo');
  }

  // 3. Check not already cancelled
  if (booking.cancelo === true) {
    throw new ConflictError('Este booking ya fue cancelado');
  }

  // 4. Check cancellation deadline (60 min before event)
  const eventDate = new Date(booking.fechaEvento);
  const now = new Date();
  const minutesUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60);

  if (minutesUntilEvent < CANCEL_DEADLINE_MINUTES) {
    throw new ValidationError(
      `No se puede cancelar con menos de ${CANCEL_DEADLINE_MINUTES} minutos de anticipación`
    );
  }

  // 5. Cancel
  const cancelled = await BookingRepository.cancelBooking(bookingId);

  // 6. Decrement inscritos
  const eventId = booking.eventoId || booking.idEvento;
  if (eventId) {
    await CalendarioRepository.decrementInscritos(eventId);
  }

  return { cancelled: true, booking: cancelled };
}
