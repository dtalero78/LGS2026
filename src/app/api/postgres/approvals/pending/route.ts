import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/approvals/pending
 *
 * Get all pending approvals
 *
 * Query params:
 * - tipo: string (optional) - Filter by approval type
 * - estado: string (optional) - Filter by status (default: "PENDIENTE")
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
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado') || 'PENDIENTE';

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Filter by estado
    if (estado) {
      conditions.push(`"estado" = $${paramIndex}`);
      values.push(estado);
      paramIndex++;
    }

    // Filter by tipo
    if (tipo) {
      conditions.push(`"tipo" = $${paramIndex}`);
      values.push(tipo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT
        a.*,
        p."primerNombre",
        p."primerApellido",
        p."email" as "studentEmail",
        p."numeroId"
      FROM "APROBACIONES" a
      LEFT JOIN "PEOPLE" p ON a."studentId" = p."_id" OR a."numeroId" = p."numeroId"
      ${whereClause}
      ORDER BY a."_createdDate" DESC`,
      values
    );

    return NextResponse.json({
      success: true,
      approvals: result.rows,
      count: result.rowCount || 0,
      filters: {
        tipo: tipo || null,
        estado: estado,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching pending approvals:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
