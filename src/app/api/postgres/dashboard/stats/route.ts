import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/dashboard/stats
 *
 * Get dashboard statistics
 *
 * Returns:
 * {
 *   totalUsers: number,
 *   activeUsers: number,
 *   inactiveUsers: number,
 *   eventsToday: number,
 *   enrollmentsToday: number,
 *   uniqueAdvisorsToday: number,
 *   topStudentsThisMonth: Array
 * }
 */
export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    // Get start of current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    // Execute all queries in parallel
    const [
      totalUsersResult,
      activeUsersResult,
      inactiveUsersResult,
      eventsTodayResult,
      enrollmentsTodayResult,
      uniqueAdvisorsTodayResult,
      topStudentsResult
    ] = await Promise.all([
      // Total users with ACADEMICA record
      query(`SELECT COUNT(*) as count FROM "ACADEMICA"`),

      // Active users
      query(`SELECT COUNT(*) as count FROM "PEOPLE" WHERE "estadoInactivo" = false`),

      // Inactive users
      query(`SELECT COUNT(*) as count FROM "PEOPLE" WHERE "estadoInactivo" = true`),

      // Events scheduled today
      query(
        `SELECT COUNT(*) as count
         FROM "CALENDARIO"
         WHERE "dia" >= $1::timestamp AND "dia" <= $2::timestamp`,
        [startOfDay, endOfDay]
      ),

      // Student enrollments today
      query(
        `SELECT COUNT(*) as count
         FROM "ACADEMICA_BOOKINGS"
         WHERE "fechaEvento" >= $1::timestamp AND "fechaEvento" <= $2::timestamp`,
        [startOfDay, endOfDay]
      ),

      // Unique advisors with events today
      query(
        `SELECT COUNT(DISTINCT "advisor") as count
         FROM "CALENDARIO"
         WHERE "dia" >= $1::timestamp AND "dia" <= $2::timestamp`,
        [startOfDay, endOfDay]
      ),

      // Top 5 students by attendance this month
      query(
        `SELECT
           b."primerNombre",
           b."primerApellido",
           b."nivel",
           p."plataforma",
           COUNT(*) as asistencias
         FROM "ACADEMICA_BOOKINGS" b
         LEFT JOIN "PEOPLE" p ON b."idEstudiante" = p."_id"
         WHERE b."asistio" = true
           AND b."fechaEvento" >= $1::timestamp
         GROUP BY b."primerNombre", b."primerApellido", b."nivel", p."plataforma"
         ORDER BY asistencias DESC
         LIMIT 5`,
        [startOfMonth]
      )
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: parseInt(totalUsersResult.rows[0]?.count || '0'),
        activeUsers: parseInt(activeUsersResult.rows[0]?.count || '0'),
        inactiveUsers: parseInt(inactiveUsersResult.rows[0]?.count || '0'),
        eventsToday: parseInt(eventsTodayResult.rows[0]?.count || '0'),
        enrollmentsToday: parseInt(enrollmentsTodayResult.rows[0]?.count || '0'),
        uniqueAdvisorsToday: parseInt(uniqueAdvisorsTodayResult.rows[0]?.count || '0'),
        topStudentsThisMonth: topStudentsResult.rows.map((row: any) => ({
          primerNombre: row.primerNombre,
          primerApellido: row.primerApellido,
          nivel: row.nivel,
          plataforma: row.plataforma,
          asistencias: parseInt(row.asistencias)
        }))
      }
    });
  } catch (error: any) {
    console.error('❌ Error getting dashboard stats:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
