'use client'

import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api, handleApiError } from './use-api'
import toast from 'react-hot-toast'

// ─── Query Keys ───
const keys = {
  events: (filters?: Record<string, any>) => ['calendar', 'events', filters] as const,
  event: (id: string) => ['calendar', 'event', id] as const,
  bookings: (eventId: string) => ['calendar', 'bookings', eventId] as const,
  batchCounts: (ids: string[]) => ['calendar', 'batch-counts', ids.sort().join(',')] as const,
  sessions: (filters?: Record<string, any>) => ['calendar', 'sessions', filters] as const,
}

// ─── Types ───
interface EventFilters {
  startDate?: string
  endDate?: string
  tipo?: string
  advisor?: string
  nivel?: string
  step?: string
}

// ─── Queries ───

/** Fetch calendar events with optional filters */
export function useCalendarEvents(filters?: EventFilters, enabled = true) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
  }
  const qs = params.toString()
  return useQuery(
    keys.events(filters),
    () => api.get(`/api/postgres/calendar/events${qs ? `?${qs}` : ''}`),
    { enabled }
  )
}

/** Fetch a single event by ID */
export function useEvent(eventId: string | undefined) {
  return useQuery(
    keys.event(eventId!),
    () => api.get(`/api/postgres/events/${encodeURIComponent(eventId!)}`),
    { enabled: !!eventId }
  )
}

/** Fetch bookings for an event */
export function useEventBookings(eventId: string | undefined) {
  return useQuery(
    keys.bookings(eventId!),
    () => api.get(`/api/postgres/events/${encodeURIComponent(eventId!)}/bookings`),
    { enabled: !!eventId }
  )
}

/** Fetch batch enrollment counts for multiple events */
export function useBatchCounts(eventIds: string[]) {
  return useQuery(
    keys.batchCounts(eventIds),
    () => api.post('/api/postgres/events/batch-counts', { eventIds }),
    { enabled: eventIds.length > 0, staleTime: 2 * 60 * 1000 }
  )
}

/** Fetch sessions list with filters */
export function useSessions(filters?: Record<string, any>) {
  return useQuery(
    keys.sessions(filters),
    () => api.post('/api/postgres/events/sessions', filters || {}),
    { enabled: true }
  )
}

// ─── Mutations ───

/** Create a new calendar event */
export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation(
    (body: Record<string, any>) => api.post('/api/postgres/events', body),
    {
      onSuccess: () => {
        qc.invalidateQueries(['calendar'])
        toast.success('Evento creado exitosamente')
      },
      onError: (err) => handleApiError(err, 'Error creando evento'),
    }
  )
}

/** Update an existing event */
export function useUpdateEvent(eventId: string) {
  const qc = useQueryClient()
  return useMutation(
    (body: Record<string, any>) => api.put(`/api/postgres/events/${encodeURIComponent(eventId)}`, body),
    {
      onSuccess: () => {
        qc.invalidateQueries(keys.event(eventId))
        qc.invalidateQueries(['calendar', 'events'])
        toast.success('Evento actualizado')
      },
      onError: (err) => handleApiError(err, 'Error actualizando evento'),
    }
  )
}

/** Delete an event */
export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation(
    (eventId: string) => api.delete(`/api/postgres/events/${encodeURIComponent(eventId)}`),
    {
      onSuccess: () => {
        qc.invalidateQueries(['calendar'])
        toast.success('Evento eliminado')
      },
      onError: (err) => handleApiError(err, 'Error eliminando evento'),
    }
  )
}

/** Enroll students in an event */
export function useEnrollStudents(eventId: string) {
  const qc = useQueryClient()
  return useMutation(
    (body: { studentIds: string[]; scheduledBy?: string }) =>
      api.post(`/api/postgres/events/${encodeURIComponent(eventId)}/enroll`, body),
    {
      onSuccess: () => {
        qc.invalidateQueries(keys.bookings(eventId))
        qc.invalidateQueries(keys.event(eventId))
        toast.success('Estudiantes inscritos')
      },
      onError: (err) => handleApiError(err, 'Error inscribiendo estudiantes'),
    }
  )
}

/** Mark attendance for a booking */
export function useMarkAttendance() {
  const qc = useQueryClient()
  return useMutation(
    (body: { bookingId: string; asistio: boolean }) =>
      api.post('/api/postgres/academic/attendance', body),
    {
      onSuccess: () => {
        qc.invalidateQueries(['calendar', 'bookings'])
      },
    }
  )
}
