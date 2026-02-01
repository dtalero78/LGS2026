import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/events/batch-counts
 *
 * Get booking counts for multiple events in a single request (performance optimization)
 *
 * Body:
 * - eventIds: string[] - Array of event IDs to get counts for
 *
 * Returns: Map of eventId -> { total, asistencias, ausencias, pendientes }
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { eventIds } = body;

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { error: 'eventIds array is required' },
        { status: 400 }
      );
    }

    // Get counts for all events in one query
    const result = await query(
      `SELECT
        COALESCE(b."eventoId", b."idEvento") as "eventId",
        COUNT(*) as "total",
        COUNT(CASE WHEN b."asistio" = true THEN 1 END) as "asistencias",
        COUNT(CASE WHEN b."asistio" = false THEN 1 END) as "ausencias",
        COUNT(CASE WHEN b."asistio" IS NULL THEN 1 END) as "pendientes"
      FROM "ACADEMICA_BOOKINGS" b
      WHERE b."eventoId" = ANY($1::text[]) OR b."idEvento" = ANY($1::text[])
      GROUP BY COALESCE(b."eventoId", b."idEvento")`,
      [eventIds]
    );

    // Build map of eventId -> counts
    const countsMap: { [key: string]: any } = {};

    // Initialize all events with zero counts
    eventIds.forEach((eventId) => {
      countsMap[eventId] = {
        total: 0,
        asistencias: 0,
        ausencias: 0,
        pendientes: 0,
      };
    });

    // Fill in actual counts
    result.rows.forEach((row) => {
      countsMap[row.eventId] = {
        total: parseInt(row.total) || 0,
        asistencias: parseInt(row.asistencias) || 0,
        ausencias: parseInt(row.ausencias) || 0,
        pendientes: parseInt(row.pendientes) || 0,
      };
    });

    return NextResponse.json({
      success: true,
      counts: countsMap,
      requestedEvents: eventIds.length,
      eventsWithBookings: result.rowCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Error fetching batch event counts:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
