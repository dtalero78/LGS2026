import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/people/[id]/comments
 *
 * Get all comments for a person/student
 *
 * Query params:
 * - limit: number (default: 50) - Maximum number of comments to return
 * - offset: number (default: 0) - Offset for pagination
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get person ID (could be _id or numeroId)
    const personResult = await query(
      `SELECT "_id", "numeroId", "primerNombre", "primerApellido"
       FROM "PEOPLE"
       WHERE "_id" = $1 OR "numeroId" = $1`,
      [params.id]
    );

    if (personResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const person = personResult.rows[0];

    // Get comments for this person
    const commentsResult = await query(
      `SELECT
        "_id",
        "personId",
        "numeroId",
        "comentario",
        "tipo",
        "creadoPor",
        "creadoPorEmail",
        "creadoPorRol",
        "_createdDate",
        "_updatedDate"
       FROM "COMENTARIOS"
       WHERE "personId" = $1 OR "numeroId" = $2
       ORDER BY "_createdDate" DESC
       LIMIT $3 OFFSET $4`,
      [person._id, person.numeroId, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM "COMENTARIOS"
       WHERE "personId" = $1 OR "numeroId" = $2`,
      [person._id, person.numeroId]
    );

    const totalComments = parseInt(countResult.rows[0]?.count || '0');

    return NextResponse.json({
      success: true,
      person: {
        _id: person._id,
        numeroId: person.numeroId,
        nombre: `${person.primerNombre} ${person.primerApellido}`,
      },
      comments: commentsResult.rows,
      count: commentsResult.rowCount || 0,
      totalComments,
      pagination: {
        limit,
        offset,
        hasMore: offset + (commentsResult.rowCount || 0) < totalComments,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching comments:', error);
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
 * POST /api/postgres/people/[id]/comments
 *
 * Add a new comment for a person/student
 *
 * Body:
 * - comentario: string - The comment text
 * - tipo: string (optional) - Comment type (e.g., "GENERAL", "ACADEMIC", "FINANCIAL")
 */
export async function POST(
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
    const { comentario, tipo } = body;

    if (!comentario || comentario.trim() === '') {
      return NextResponse.json(
        { error: 'comentario is required' },
        { status: 400 }
      );
    }

    // Get person details
    const personResult = await query(
      `SELECT "_id", "numeroId", "primerNombre", "primerApellido"
       FROM "PEOPLE"
       WHERE "_id" = $1 OR "numeroId" = $1`,
      [params.id]
    );

    if (personResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const person = personResult.rows[0];

    // Create comment
    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const insertResult = await query(
      `INSERT INTO "COMENTARIOS" (
        "_id",
        "personId",
        "numeroId",
        "comentario",
        "tipo",
        "creadoPor",
        "creadoPorEmail",
        "creadoPorRol",
        "_createdDate",
        "_updatedDate"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING *`,
      [
        commentId,
        person._id,
        person.numeroId,
        comentario.trim(),
        tipo || 'GENERAL',
        session.user?.name || 'System',
        session.user?.email || 'system@lgs.com',
        session.user?.rol || 'USER',
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Comment added successfully',
      comment: insertResult.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error adding comment:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
