/**
 * Panel Estudiante Service
 *
 * Business logic for the student-facing portal.
 * Resolves the logged-in student from their session, then delegates
 * to existing repositories for data fetching.
 */

import 'server-only';
import { Session } from 'next-auth';
import { PeopleRepository } from '@/repositories/people.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { getProfile } from '@/services/student.service';
import { generateReport } from '@/services/progress.service';

/**
 * Resolve the PEOPLE record for the logged-in student.
 * Verifies the session role is ESTUDIANTE and looks up by email.
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

  const student = await PeopleRepository.findByEmail(email);
  if (!student) {
    throw new NotFoundError('Estudiante', email);
  }

  return student;
}

/**
 * Get the full student profile (ACADEMICA + PEOPLE merge).
 * Reuses the existing student.service.getProfile() which tries
 * ACADEMICA first, then falls back to PEOPLE.
 */
export async function getStudentProfile(studentId: string) {
  return getProfile(studentId);
}

/**
 * Get the student's upcoming (non-cancelled) events with advisor name and Zoom link.
 */
export async function getStudentUpcomingEvents(studentId: string) {
  return BookingRepository.findUpcomingByStudentId(studentId, 10);
}

/**
 * Get attendance statistics for the student.
 */
export async function getStudentStats(studentId: string) {
  return BookingRepository.getStudentAttendanceStats(studentId);
}

/**
 * Get the "¿Cómo voy?" progress report.
 * Reuses the existing progress.service.generateReport().
 */
export async function getStudentProgress(studentId: string) {
  return generateReport(studentId);
}

/**
 * Get the student's full class history.
 */
export async function getStudentHistory(studentId: string) {
  return BookingRepository.findByStudentId(studentId, 500);
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
export async function getStudentComments(studentId: string) {
  return BookingRepository.findCommentsForStudent(studentId, 50);
}
