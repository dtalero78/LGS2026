import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/people/beneficiarios-sin-registro
 *
 * Get all beneficiarios (students) who don't have an academic record (ACADEMICA)
 *
 * Query params:
 * - nivel: string (optional) - Filter by nivel
 * - contrato: string (optional) - Filter by contrato
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
    const nivel = searchParams.get('nivel');
    const contrato = searchParams.get('contrato');

    // Build WHERE clause
    const conditions: string[] = [
      `p."tipoUsuario" = 'BENEFICIARIO'`,
      `a."_id" IS NULL`, // No academic record
    ];
    const values: any[] = [];
    let paramIndex = 1;

    if (nivel) {
      conditions.push(`p."nivel" = $${paramIndex}`);
      values.push(nivel);
      paramIndex++;
    }

    if (contrato) {
      conditions.push(`p."contrato" = $${paramIndex}`);
      values.push(contrato);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `SELECT
        p.*,
        NULL as "hasAcademicRecord"
      FROM "PEOPLE" p
      LEFT JOIN "ACADEMICA" a ON p."numeroId" = a."numeroId"
      ${whereClause}
      ORDER BY p."primerApellido", p."primerNombre"`,
      values
    );

    return NextResponse.json({
      success: true,
      beneficiarios: result.rows,
      count: result.rowCount || 0,
      message: result.rowCount === 0
        ? 'Todos los beneficiarios tienen registro académico'
        : `${result.rowCount} beneficiarios sin registro académico`,
    });
  } catch (error: any) {
    console.error('❌ Error fetching beneficiarios sin registro:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
