import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * PUT /api/postgres/approvals/[id]
 *
 * Update an approval (approve or reject)
 *
 * Body:
 * - estado: string - "APROBADO" or "RECHAZADO"
 * - comentarios: string (optional) - Comments about the decision
 * - aprobadoPor: string (optional) - Who approved/rejected (defaults to session user)
 */
export async function PUT(
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

    const body = await request.json();
    const { estado, comentarios } = body;

    if (!estado) {
      return NextResponse.json(
        { error: 'estado is required' },
        { status: 400 }
      );
    }

    if (!['APROBADO', 'RECHAZADO', 'PENDIENTE'].includes(estado)) {
      return NextResponse.json(
        { error: 'estado must be APROBADO, RECHAZADO, or PENDIENTE' },
        { status: 400 }
      );
    }

    // Check if approval exists
    const approvalCheck = await query(
      `SELECT "_id", "estado" FROM "APROBACIONES" WHERE "_id" = $1`,
      [params.id]
    );

    if (approvalCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }

    // Update approval
    const updateResult = await query(
      `UPDATE "APROBACIONES"
       SET "estado" = $1,
           "comentarios" = $2,
           "aprobadoPor" = $3,
           "aprobadoPorEmail" = $4,
           "fechaAprobacion" = NOW(),
           "_updatedDate" = NOW()
       WHERE "_id" = $5
       RETURNING *`,
      [
        estado,
        comentarios || null,
        session.user?.name || 'System',
        session.user?.email || 'system@lgs.com',
        params.id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Aprobación ${estado === 'APROBADO' ? 'aprobada' : estado === 'RECHAZADO' ? 'rechazada' : 'actualizada'} exitosamente`,
      approval: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error updating approval:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/postgres/approvals/[id]
 *
 * Get a single approval by ID
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

    const result = await query(
      `SELECT
        a.*,
        p."primerNombre",
        p."primerApellido",
        p."email" as "studentEmail",
        p."numeroId"
      FROM "APROBACIONES" a
      LEFT JOIN "PEOPLE" p ON a."studentId" = p."_id" OR a."numeroId" = p."numeroId"
      WHERE a."_id" = $1`,
      [params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      approval: result.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error fetching approval:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
