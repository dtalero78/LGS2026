/**
 * Dashboard Service
 *
 * Aggregated statistics for the main dashboard.
 * Runs all queries in parallel for performance.
 */

import 'server-only';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { CalendarioRepository } from '@/repositories/calendar.repository';
import { BookingRepository } from '@/repositories/booking.repository';

/**
 * Get all dashboard statistics.
 */
export async function getStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    eventsToday,
    enrollmentsToday,
    uniqueAdvisorsToday,
    topStudents,
  ] = await Promise.all([
    AcademicaRepository.countTotal(),
    PeopleRepository.countActive(),
    PeopleRepository.countInactive(),
    CalendarioRepository.countEventsInRange(todayStart, todayEnd),
    BookingRepository.countEnrollmentsInRange(todayStart, todayEnd),
    CalendarioRepository.countUniqueAdvisorsInRange(todayStart, todayEnd),
    BookingRepository.topStudentsByAttendance(monthStart, 5),
  ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    eventsToday,
    enrollmentsToday,
    uniqueAdvisorsToday,
    topStudentsThisMonth: topStudents,
  };
}
