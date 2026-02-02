import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/events/filtered
 *
 * Get events filtered by multiple criteria
 *
 * Query params:
 * - nivel: string - Filter by nivel (e.g., "BN1", "BN2")
 * - step: string - Filter by step (e.g., "Step 1", "Step 2")
 * - tipo: string - Filter by tipo (e.g., "SESSION", "CLUB", "WELCOME")
 * - tipoEvento: string - Alias for tipo
 * - advisor: string - Filter by advisor email
 * - fechaInicio: ISO date string - Start date filter
 * - fechaFin: ISO date string - End date filter
 * - startDate: ISO date string - Alias for fechaInicio
 * - endDate: ISO date string - Alias for fechaFin
 * - includeBookings: boolean - Include booking counts
 *
 * Example: /api/postgres/events/filtered?nivel=BN1&tipoEvento=SESSION&fechaInicio=2025-01-01&fechaFin=2025-01-31
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

    // Build WHERE clause dynamically
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Filter by nivel
    const nivel = searchParams.get('nivel');
    if (nivel) {
      conditions.push(`c."nivel" = $${paramIndex}`);
      values.push(nivel);
      paramIndex++;
    }

    // Filter by step
    const step = searchParams.get('step');
    if (step) {
      conditions.push(`c."step" = $${paramIndex}`);
      values.push(step);
      paramIndex++;
    }

    // Filter by tipo (support both 'tipo' and 'tipoEvento')
    const tipo = searchParams.get('tipo') || searchParams.get('tipoEvento');
    if (tipo) {
      conditions.push(`c."tipo" = $${paramIndex}`);
      values.push(tipo);
      paramIndex++;
    }

    // Filter by advisor
    const advisor = searchParams.get('advisor');
    if (advisor) {
      conditions.push(`c."advisor" = $${paramIndex}`);
      values.push(advisor);
      paramIndex++;
    }

    // Filter by date range (support both fechaInicio/fechaFin and startDate/endDate)
    const fechaInicio = searchParams.get('fechaInicio') || searchParams.get('startDate');
    if (fechaInicio) {
      conditions.push(`c."dia" >= $${paramIndex}::timestamp with time zone`);
      values.push(fechaInicio);
      paramIndex++;
    }

    const fechaFin = searchParams.get('fechaFin') || searchParams.get('endDate');
    if (fechaFin) {
      conditions.push(`c."dia" <= $${paramIndex}::timestamp with time zone`);
      values.push(fechaFin);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Check if we should include booking counts
    const includeBookings = searchParams.get('includeBookings') === 'true';

    let queryText: string;

    if (includeBookings) {
      queryText = `
        SELECT
          c.*,
          a."primerNombre" as "advisorPrimerNombre",
          a."primerApellido" as "advisorPrimerApellido",
          a."nombreCompleto" as "advisorNombreCompleto",
          COUNT(DISTINCT b."_id") as "bookingCount",
          COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "asistenciasCount",
          COUNT(DISTINCT CASE WHEN b."asistio" = false THEN b."_id" END) as "ausenciasCount"
        FROM "CALENDARIO" c
        LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
        LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
        ${whereClause}
        GROUP BY c."_id", a."primerNombre", a."primerApellido", a."nombreCompleto"
        ORDER BY c."dia" DESC, c."hora" DESC
      `;
    } else {
      queryText = `
        SELECT
          c.*,
          a."primerNombre" as "advisorPrimerNombre",
          a."primerApellido" as "advisorPrimerApellido",
          a."nombreCompleto" as "advisorNombreCompleto"
        FROM "CALENDARIO" c
        LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
        ${whereClause}
        ORDER BY c."dia" DESC, c."hora" DESC
      `;
    }

    const result = await query(queryText, values);

    return NextResponse.json({
      success: true,
      events: result.rows,
      count: result.rowCount || 0,
      filters: {
        nivel: nivel || null,
        step: step || null,
        tipo: tipo || null,
        advisor: advisor || null,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching filtered events:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
