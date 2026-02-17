/**
 * Panel Estudiante Service
 *
 * Business logic for the student-facing portal.
 * Resolves the logged-in student from their session, then delegates
 * to existing repositories for data fetching.
 *
 * IMPORTANT: Students have TWO records — PEOPLE (personal data) and ACADEMICA
 * (academic data with nivel/step). Bookings reference the ACADEMICA._id via
 * "idEstudiante", NOT the PEOPLE._id. This service merges both records and
 * exposes `academicaId` for booking queries.
 */

import 'server-only';
import { Session } from 'next-auth';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { generateReport } from '@/services/progress.service';

/**
 * Resolve the student from the session.
 * Returns a merged PEOPLE + ACADEMICA object with `academicaId` for booking queries.
 *
 * Lookup chain:
 *   1. PEOPLE by email (session.user.email)
 *   2. ACADEMICA by PEOPLE.numeroId (links the two tables)
 *   3. Merge: PEOPLE base + ACADEMICA overrides (nivel, step, academicaId)
 */
export async function resolveStudentFromSession(session: Session) {
  const role = (session.user as any)?.role;
  if (role !== 'ESTUDIANTE') {
    throw new ForbiddenError('Solo estudiantes pueden acceder a este panel');
  }

  const email = session.user?.email;
  if (!email) {
    throw new ForbiddenError('No se encontró email en la sesión');
  }

  const person = await PeopleRepository.findByEmail(email);
  if (!person) {
    throw new NotFoundError('Estudiante', email);
  }

  // Look up ACADEMICA record (has nivel/step and is the ID used by bookings)
  let academicaId: string | null = null;
  let nivel: string | null = person.nivel || null;
  let step: string | null = person.step || null;
  let nivelParalelo: string | null = person.nivelParalelo || null;
  let stepParalelo: string | null = person.stepParalelo || null;

  if (person.numeroId) {
    const academica = await AcademicaRepository.findByNumeroId(person.numeroId);
    if (academica) {
      academicaId = academica._id;
      nivel = academica.nivel || nivel;
      step = academica.step || step;
      nivelParalelo = academica.nivelParalelo || nivelParalelo;
      stepParalelo = academica.stepParalelo || stepParalelo;
    }
  }

  return {
    ...person,
    academicaId,  // ACADEMICA._id — use this for booking queries
    nivel,
    step,
    nivelParalelo,
    stepParalelo,
  };
}

/**
 * Get the full student profile (merged PEOPLE + ACADEMICA).
 * The resolveStudentFromSession already merges both, so this just
 * re-returns it — but also called from the /me route with the resolved student.
 */
export async function getStudentProfile(student: any) {
  return student;
}

/**
 * Get the student's upcoming (non-cancelled) events with advisor name and Zoom link.
 * Uses academicaId because bookings reference ACADEMICA._id via "idEstudiante".
 */
export async function getStudentUpcomingEvents(academicaId: string) {
  return BookingRepository.findUpcomingByStudentId(academicaId, 10);
}

/**
 * Get attendance statistics for the student.
 */
export async function getStudentStats(academicaId: string) {
  return BookingRepository.getStudentAttendanceStats(academicaId);
}

/**
 * Get the "¿Cómo voy?" progress report.
 * Passes the ACADEMICA _id so generateReport finds both the record and its bookings.
 */
export async function getStudentProgress(academicaId: string) {
  return generateReport(academicaId);
}

/**
 * Get the student's full class history.
 */
export async function getStudentHistory(academicaId: string) {
  return BookingRepository.findByStudentId(academicaId, 500);
}

/**
 * Get downloadable materials for the student's current nivel.
 */
export async function getStudentMaterials(nivel: string) {
  return NivelesRepository.findByCode(nivel);
}

/**
 * Get advisor comments/annotations for the student.
 */
export async function getStudentComments(academicaId: string) {
  return BookingRepository.findCommentsForStudent(academicaId, 50);
}
