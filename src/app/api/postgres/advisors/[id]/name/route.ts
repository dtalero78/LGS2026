import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/advisors/[id]/name
 *
 * Get advisor's name (email) - simple endpoint for quick lookups
 *
 * [id] can be the advisor's email (returns email, mainly for consistency with Wix API)
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

    const advisorId = decodeURIComponent(params.id);

    // Check if advisor exists in USUARIOS_ROLES
    const result = await query(
      `SELECT "email", "rol", "activo" FROM "USUARIOS_ROLES"
       WHERE "email" = $1 AND "activo" = true`,
      [advisorId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Advisor not found' },
        { status: 404 }
      );
    }

    const advisor = result.rows[0];

    return NextResponse.json({
      success: true,
      advisorId: advisor.email,
      email: advisor.email,
      rol: advisor.rol,
      name: advisor.email, // In the current system, we use email as name
    });
  } catch (error: any) {
    console.error('❌ Error fetching advisor name:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
