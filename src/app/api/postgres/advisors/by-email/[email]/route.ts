import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/advisors/by-email/[email]
 *
 * Get advisor details by email
 */
export async function GET(
  request: Request,
  { params }: { params: { email: string } }
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

    const decodedEmail = decodeURIComponent(params.email);

    // Search in USUARIOS_ROLES table for advisor
    const result = await query(
      `SELECT
        "email",
        "rol",
        "activo",
        "_createdDate",
        "_updatedDate"
      FROM "USUARIOS_ROLES"
      WHERE "email" = $1 AND "activo" = true`,
      [decodedEmail]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Advisor not found' },
        { status: 404 }
      );
    }

    const advisor = result.rows[0];

    // Get additional stats for this advisor
    const statsResult = await query(
      `SELECT
        COUNT(DISTINCT c."_id") as "totalEventos",
        COUNT(DISTINCT b."_id") as "totalInscripciones",
        COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "totalAsistencias"
      FROM "CALENDARIO" c
      LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
      WHERE c."advisor" = $1`,
      [decodedEmail]
    );

    const stats = statsResult.rows[0] || {
      totalEventos: 0,
      totalInscripciones: 0,
      totalAsistencias: 0,
    };

    return NextResponse.json({
      success: true,
      advisor: {
        ...advisor,
        stats: {
          totalEventos: parseInt(stats.totalEventos) || 0,
          totalInscripciones: parseInt(stats.totalInscripciones) || 0,
          totalAsistencias: parseInt(stats.totalAsistencias) || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching advisor by email:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
