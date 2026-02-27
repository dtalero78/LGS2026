/**
 * Student Booking Service
 *
 * Business logic for student self-booking: browse available events,
 * book with capacity/weekly-limit/same-day checks, and cancel.
 */

import 'server-only';
import { CalendarioRepository } from '@/repositories/calendar.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { StepOverridesRepository } from '@/repositories/niveles.repository';
import { ValidationError, ConflictError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { queryMany } from '@/lib/postgres';

// --- Helpers (mirrors progress.service.ts logic) ---

function extractStepNumber(stepName: string): number | null {
  const match = stepName?.match(/Step\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function isExitosaBooking(c: any): boolean {
  return c.asistio === true || c.asistencia === true || c.participacion === true;
}

function getClassTypeBooking(c: any): 'SESSION' | 'CLUB' | 'OTHER' {
  if (c.tipo === 'SESSION') return 'SESSION';
  if (c.tipo === 'CLUB') return 'CLUB';
  if (!c.tipo && c.step) {
    if (/^TRAINING\s*-/i.test(c.step)) return 'CLUB';
    if (/^Step\s+\d+$/i.test(c.step)) return 'SESSION';
  }
  return 'OTHER';
}

/**
 * Determines the first incomplete step number for a student in their current nivel.
 * Returns 0 if all steps are complete or nivel has no steps in NIVELES.
 */
export async function getEffectiveStepNumber(
  academicaId: string,
  peopleId: string,
  nivel: string
): Promise<number> {
  if (!nivel) return 0;

  const stepsRows = await queryMany<{ step: string }>(
    `SELECT DISTINCT "step" FROM "NIVELES" WHERE "code" = $1 AND "step" != 'WELCOME' ORDER BY "step"`,
    [nivel]
  );
  if (stepsRows.length === 0) return 0;

  const allSteps = stepsRows
    .map(r => r.step)
    .sort((a, b) => (extractStepNumber(a) ?? 0) - (extractStepNumber(b) ?? 0));

  const classes = await queryMany(
    `SELECT "step", "nombreEvento", "tipo", "asistio", "asistencia", "participacion", "noAprobo"
     FROM "ACADEMICA_BOOKINGS"
     WHERE ("idEstudiante" = $1 OR "studentId" = $1) AND "nivel" = $2`,
    [academicaId, nivel]
  );

  const overrides = await StepOverridesRepository.findByStudentId(peopleId);
  const overrideMap = new Map(overrides.map((o: any) => [o.step, o.isCompleted]));

  for (const stepName of allSteps) {
    const stepNum = extractStepNumber(stepName);
    if (stepNum === null) continue;

    const overrideVal = overrideMap.get(stepName);
    if (overrideVal === true) continue;   // completed by override → next step
    if (overrideVal === false) return stepNum; // forced incomplete

    const clasesDelStep = classes.filter(c => {
      const n = extractStepNumber(c.step || c.nombreEvento || '');
      return n === stepNum;
    });

    const esJump = stepNum > 0 && stepNum % 5 === 0;

    if (esJump) {
      const tieneNoAprobo = clasesDelStep.some(c => c.noAprobo === true);
      if (tieneNoAprobo || clasesDelStep.length === 0) return stepNum;
    } else {
      const sesionesExitosas = clasesDelStep.filter(c => getClassTypeBooking(c) === 'SESSION' && isExitosaBooking(c)).length;
      const clubsExitosos = clasesDelStep.filter(c => getClassTypeBooking(c) === 'CLUB' && isExitosaBooking(c)).length;
      if (sesionesExitosas < 2 || clubsExitosos < 1) return stepNum;
    }
  }

  return 0; // all steps complete
}

const WEEKLY_SESSION_LIMIT = 2;
const WEEKLY_CLUB_LIMIT = 3;
const WEEKLY_TRAINING_LIMIT = 1;
const CANCEL_DEADLINE_MINUTES = 60;
const BOOKING_MIN_ADVANCE_MINUTES = 30;

/**
 * Get events available for a student to book.
 * Filters by date range, nivel, tipo, and annotates each event with
 * capacity status and whether the student is already enrolled.
 */
export async function getAvailableEvents(
  studentId: string,
  peopleId: string,
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

  // Get hours where student already has a booking on this date (same-hour exclusion)
  const bookedHours = await BookingRepository.findBookedHoursForDate(studentId, date);
  const bookedHoursSet = new Set(bookedHours);

  // Determine the effective step based on actual progress
  const effectiveStepNum = await getEffectiveStepNumber(studentId, peopleId, nivel);

  // Fallback to stored step if NIVELES has no data for this nivel
  const fallbackStepNum = extractStepNumber(step) ?? 0;
  const activeStepNum = effectiveStepNum > 0 ? effectiveStepNum : fallbackStepNum;

  const isActiveJump = activeStepNum > 0 && activeStepNum % 5 === 0;

  const now = new Date();

  // Annotate events
  const annotated = await Promise.all(
    events.map(async (evt: any) => {
      // Filter out events less than 30 min from now
      const evtDate = new Date(evt.dia);
      const minutesUntil = (evtDate.getTime() - now.getTime()) / (1000 * 60);
      if (minutesUntil < BOOKING_MIN_ADVANCE_MINUTES) {
        return null;
      }

      // Same-hour exclusion: skip events at hours where student already has a booking
      if (evt.hora && bookedHoursSet.has(evt.hora)) {
        return null;
      }

      const activeCount = await CalendarioRepository.countActiveEnrollments(evt._id);
      const cupoLleno = evt.limiteUsuarios > 0 && activeCount >= evt.limiteUsuarios;
      const yaInscrito = enrolledEventIds.has(evt._id);

      const evtStepNum = extractStepNumber(evt.step || evt.nombreEvento || '');
      const isJumpEvent = evtStepNum !== null && evtStepNum > 0 && evtStepNum % 5 === 0;

      if (isActiveJump) {
        // Student completed all regular steps → show ONLY the specific jump event
        if (!isJumpEvent || evtStepNum !== activeStepNum) return null;
      } else {
        // Student is on a regular step → show all non-jump events, hide jump events
        if (isJumpEvent) return null;
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

  // 2. Validate future date + 30 min advance
  const eventDate = new Date(event.dia);
  const now = new Date();
  const minutesUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60);
  if (minutesUntil <= 0) {
    throw new ValidationError('No se puede agendar en un evento pasado');
  }
  if (minutesUntil < BOOKING_MIN_ADVANCE_MINUTES) {
    throw new ValidationError(`Debes agendar con al menos ${BOOKING_MIN_ADVANCE_MINUTES} minutos de anticipación`);
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

  const eventTipo = event.tipo || event.evento || '';

  // 5. Pending SESSION rule: can't book a new SESSION if you already have one pending
  if (eventTipo === 'SESSION') {
    const hasPending = await BookingRepository.hasPendingSession(studentId);
    if (hasPending) {
      throw new ConflictError('Ya tienes una sesión reservada y pendiente. Solo puedes reservar otra cuando pase tu sesión actual.');
    }
  }

  // 6. Check weekly limits
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

    // TRAINING limit: max 1 per week
    const eventName = event.nombreEvento || event.titulo || '';
    const isTraining = /^TRAINING\s*-/i.test(eventName);
    if (isTraining) {
      const currentTrainings = await BookingRepository.countWeeklyTrainingBookings(
        studentId,
        weekStart.toISOString(),
        weekEnd.toISOString()
      );
      if (currentTrainings >= WEEKLY_TRAINING_LIMIT) {
        throw new ConflictError(`Límite semanal alcanzado: máximo ${WEEKLY_TRAINING_LIMIT} TRAINING por semana`);
      }
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
    origen: 'PANEL_EST',
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
