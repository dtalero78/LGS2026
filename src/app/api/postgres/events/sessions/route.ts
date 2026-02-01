import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/events/sessions
 *
 * Get all session events (tipo = SESSION)
 *
 * Query params:
 * - startDate: ISO date string - Start date filter
 * - endDate: ISO date string - End date filter
 * - advisor: string - Filter by advisor email
 * - nivel: string - Filter by nivel
 * - includeBookings: boolean - Include booking counts
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

    const { searchParams } = new URL(request.url);

    // Build WHERE clause - filter by tipo = SESSION
    const conditions: string[] = [`"tipo" = 'SESSION'`];
    const values: any[] = [];
    let paramIndex = 1;

    // Filter by date range
    const startDate = searchParams.get('startDate');
    if (startDate) {
      conditions.push(`"dia" >= $${paramIndex}::timestamp with time zone`);
      values.push(startDate);
      paramIndex++;
    }

    const endDate = searchParams.get('endDate');
    if (endDate) {
      conditions.push(`"dia" <= $${paramIndex}::timestamp with time zone`);
      values.push(endDate);
      paramIndex++;
    }

    // Filter by advisor
    const advisor = searchParams.get('advisor');
    if (advisor) {
      conditions.push(`"advisor" = $${paramIndex}`);
      values.push(advisor);
      paramIndex++;
    }

    // Filter by nivel
    const nivel = searchParams.get('nivel');
    if (nivel) {
      conditions.push(`"nivel" = $${paramIndex}`);
      values.push(nivel);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Check if we should include booking counts
    const includeBookings = searchParams.get('includeBookings') === 'true';

    let queryText: string;

    if (includeBookings) {
      queryText = `
        SELECT
          c.*,
          COUNT(DISTINCT b."_id") as "bookingCount",
          COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "asistenciasCount",
          COUNT(DISTINCT CASE WHEN b."asistio" = false THEN b."_id" END) as "ausenciasCount"
        FROM "CALENDARIO" c
        LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
        ${whereClause}
        GROUP BY c."_id"
        ORDER BY c."dia" DESC, c."hora" DESC
      `;
    } else {
      queryText = `
        SELECT * FROM "CALENDARIO"
        ${whereClause}
        ORDER BY "dia" DESC, "hora" DESC
      `;
    }

    const result = await query(queryText, values);

    return NextResponse.json({
      success: true,
      events: result.rows,
      count: result.rowCount || 0,
      tipo: 'SESSION',
    });
  } catch (error: any) {
    console.error('❌ Error fetching session events:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
