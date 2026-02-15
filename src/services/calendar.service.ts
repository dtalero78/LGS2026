/**
 * Calendar Service
 *
 * Business logic for event CRUD with cascading operations.
 */

import 'server-only';
import { CalendarioRepository, EventFilters } from '@/repositories/calendar.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

/**
 * Get events with filters and advisor details.
 */
export async function getEvents(filters: EventFilters) {
  if (filters.includeBookingCounts) {
    return CalendarioRepository.findEventsWithBookingCounts(filters);
  }
  return CalendarioRepository.findEvents(filters);
}

/**
 * Get booking counts for multiple events at once.
 */
export async function getBatchBookingCounts(eventIds: string[]) {
  const rows = await BookingRepository.getBatchCounts(eventIds);

  // Build map with defaults for all requested events
  const countsMap: Record<string, { total: number; asistencias: number; ausencias: number; pendientes: number }> = {};
  for (const id of eventIds) {
    countsMap[id] = { total: 0, asistencias: 0, ausencias: 0, pendientes: 0 };
  }
  for (const row of rows) {
    countsMap[row.eventId] = {
      total: parseInt(row.total) || 0,
      asistencias: parseInt(row.asistencias) || 0,
      ausencias: parseInt(row.ausencias) || 0,
      pendientes: parseInt(row.pendientes) || 0,
    };
  }
  return countsMap;
}

/**
 * Get a single event by ID with advisor details.
 */
export async function getEventById(eventId: string) {
  const event = await CalendarioRepository.findByIdWithAdvisor(eventId);
  if (!event) throw new NotFoundError('Event', eventId);
  return event;
}

/**
 * Create a new calendar event.
 */
export async function createEvent(data: {
  dia: string;
  fecha?: string;
  hora: string;
  advisor: string;
  nivel?: string;
  step?: string;
  tipo: string;
  titulo?: string;
  nombreEvento?: string;
  tituloONivel?: string;
  linkZoom?: string;
  limiteUsuarios?: number;
  club?: string;
  observaciones?: string;
}) {
  if (!data.dia) throw new ValidationError('dia is required');
  if (!data.hora) throw new ValidationError('hora is required');
  if (!data.tipo) throw new ValidationError('tipo is required');

  const eventData: Record<string, any> = {
    _id: ids.event(),
    dia: data.dia,
    fecha: data.fecha || data.dia.split('T')[0],
    hora: data.hora,
    advisor: data.advisor,
    nivel: data.nivel || null,
    step: data.step || null,
    tipo: data.tipo,
    titulo: data.titulo || data.nombreEvento || '',
    nombreEvento: data.nombreEvento || data.titulo || '',
    tituloONivel: data.tituloONivel || (data.nivel ? `${data.nivel} ${data.step || ''}`.trim() : ''),
    linkZoom: data.linkZoom || null,
    limiteUsuarios: data.limiteUsuarios || 0,
    club: data.club || null,
    observaciones: data.observaciones || null,
  };

  return CalendarioRepository.create(eventData);
}

const ALLOWED_EVENT_FIELDS = [
  'dia', 'hora', 'advisor', 'nivel', 'step', 'tipo', 'titulo',
  'nombreEvento', 'linkZoom', 'limiteUsuarios', 'club', 'observaciones',
];

/**
 * Update an existing event.
 */
export async function updateEvent(eventId: string, data: Record<string, any>) {
  const event = await CalendarioRepository.findById(eventId);
  if (!event) throw new NotFoundError('Event', eventId);

  const updated = await CalendarioRepository.updateEvent(eventId, data, ALLOWED_EVENT_FIELDS);
  if (!updated) throw new ValidationError('No valid fields to update');
  return updated;
}

/**
 * Delete an event, optionally deleting its bookings too.
 */
export async function deleteEvent(eventId: string, deleteBookings: boolean = true) {
  const event = await CalendarioRepository.getInscritos(eventId);
  if (!event) throw new NotFoundError('Event', eventId);

  let bookingsDeleted = 0;
  if (deleteBookings) {
    const deleted = await BookingRepository.deleteByEventId(eventId);
    bookingsDeleted = deleted.length;
  }

  await CalendarioRepository.deleteById(eventId);

  return { bookingsDeleted };
}

/**
 * Get bookings for an event with attendance stats.
 */
export async function getEventBookings(eventId: string, includeStudent: boolean = false) {
  const bookings = includeStudent
    ? await BookingRepository.findByEventIdWithStudentDetails(eventId)
    : await BookingRepository.findByEventId(eventId);

  const stats = {
    total: bookings.length,
    asistencias: bookings.filter((b: any) => b.asistio === true).length,
    ausencias: bookings.filter((b: any) => b.asistio === false).length,
    pendientes: bookings.filter((b: any) => b.asistio === null).length,
  };

  return { bookings, stats };
}
