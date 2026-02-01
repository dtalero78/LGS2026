import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/events/[id]/bookings
 *
 * Get all bookings for a specific event
 *
 * Query params:
 * - includeStudent: boolean (default: false) - Include full student details from PEOPLE table
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
    const includeStudent = searchParams.get('includeStudent') === 'true';

    let queryText: string;
    let queryParams: any[];

    if (includeStudent) {
      // Join with PEOPLE to get full student details
      queryText = `
        SELECT
          b.*,
          p."email" as "studentEmail",
          p."plataforma" as "studentPlataforma",
          p."estadoInactivo" as "studentInactivo",
          p."vigencia" as "studentVigencia",
          p."finalContrato" as "studentFinalContrato"
        FROM "ACADEMICA_BOOKINGS" b
        LEFT JOIN "PEOPLE" p ON b."idEstudiante" = p."_id"
        WHERE b."eventoId" = $1 OR b."idEvento" = $1
        ORDER BY b."primerApellido", b."primerNombre"
      `;
      queryParams = [params.id];
    } else {
      // Just return booking data
      queryText = `
        SELECT * FROM "ACADEMICA_BOOKINGS"
        WHERE "eventoId" = $1 OR "idEvento" = $1
        ORDER BY "primerApellido", "primerNombre"
      `;
      queryParams = [params.id];
    }

    const result = await query(queryText, queryParams);

    // Calculate stats
    const bookings = result.rows;
    const totalBookings = bookings.length;
    const asistencias = bookings.filter((b) => b.asistio === true).length;
    const ausencias = bookings.filter((b) => b.asistio === false).length;
    const pendientes = bookings.filter((b) => b.asistio === null).length;

    return NextResponse.json({
      success: true,
      bookings,
      stats: {
        total: totalBookings,
        asistencias,
        ausencias,
        pendientes,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching event bookings:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
