import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/advisors/[id]/events
 *
 * Get all events for a specific advisor
 *
 * Query params:
 * - startDate: ISO date string - Start date filter
 * - endDate: ISO date string - End date filter
 * - tipo: string - Filter by event type (SESSION, CLUB, WELCOME)
 * - includeBookings: boolean - Include booking counts
 *
 * [id] can be the advisor's email
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const advisorId = decodeURIComponent(params.id);

    // Build WHERE clause
    const conditions: string[] = [`"advisor" = $1`];
    const values: any[] = [advisorId];
    let paramIndex = 2;

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

    // Filter by tipo
    const tipo = searchParams.get('tipo');
    if (tipo) {
      conditions.push(`"tipo" = $${paramIndex}`);
      values.push(tipo);
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
      advisor: advisorId,
    });
  } catch (error: any) {
    console.error('❌ Error fetching advisor events:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
