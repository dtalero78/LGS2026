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
import { getEffectiveStepNumber } from '@/services/student-booking.service';

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

  // Lookup chain:
  // 1. PEOPLE by email → then ACADEMICA by PEOPLE.numeroId
  // 2. Fallback: ACADEMICA by email → then PEOPLE by ACADEMICA.numeroId
  let person = await PeopleRepository.findByEmail(email);
  let academica = null;

  if (person) {
    if (person.numeroId) {
      academica = await AcademicaRepository.findByNumeroId(person.numeroId);
    }
  } else {
    // Email not in PEOPLE — try ACADEMICA directly (email stored there)
    academica = await AcademicaRepository.findByEmail(email);
    if (!academica) {
      throw new NotFoundError('Estudiante', email);
    }
    // Try to find PEOPLE via ACADEMICA.numeroId
    if (academica.numeroId) {
      person = await PeopleRepository.findByIdOrNumeroId(academica.numeroId);
    }
  }

  // Build a base object from whichever source we have
  const base = person ?? academica;
  if (!base) {
    throw new NotFoundError('Estudiante', email);
  }

  const academicaId: string | null = academica?._id ?? null;
  const nivel: string | null = academica?.nivel ?? (base as any).nivel ?? null;
  const step: string | null = academica?.step ?? (base as any).step ?? null;
  const nivelParalelo: string | null = academica?.nivelParalelo ?? (base as any).nivelParalelo ?? null;
  const stepParalelo: string | null = academica?.stepParalelo ?? (base as any).stepParalelo ?? null;

  // Calculate the effective step (first incomplete step based on real progress)
  const effectiveStepNum = nivel
    ? await getEffectiveStepNumber(academicaId ?? (base as any)._id, (base as any)._id, nivel)
    : 0;
  const effectiveStep = effectiveStepNum > 0 ? `Step ${effectiveStepNum}` : step;

  return {
    ...base,
    academicaId,  // ACADEMICA._id — use this for booking queries
    nivel,
    step,
    effectiveStep, // First incomplete step (used for display in header/card)
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
