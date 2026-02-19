import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/advisors/by-email/[email]
 *
 * Get advisor details by email from ADVISORS table
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

    const result = await query(
      `SELECT "_id", "email", "primerNombre", "primerApellido", "nombreCompleto", "zoom", "activo"
       FROM "ADVISORS"
       WHERE "email" = $1`,
      [decodedEmail]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Advisor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      advisor: result.rows[0],
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
