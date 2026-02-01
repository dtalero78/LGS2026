import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/roles
 *
 * Get all roles
 *
 * Query params:
 * - activo: boolean (optional) - Filter by active status
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
    const activo = searchParams.get('activo');

    let queryText: string;
    let queryParams: any[] = [];

    if (activo !== null) {
      queryText = `
        SELECT * FROM "ROL_PERMISOS"
        WHERE "activo" = $1
        ORDER BY "rol"
      `;
      queryParams = [activo === 'true'];
    } else {
      queryText = `
        SELECT * FROM "ROL_PERMISOS"
        ORDER BY "rol"
      `;
    }

    const result = await query(queryText, queryParams);

    return NextResponse.json({
      success: true,
      roles: result.rows,
      count: result.rowCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Error fetching roles:', error);
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
 * POST /api/postgres/roles
 *
 * Create a new role
 *
 * Body:
 * - rol: string - Role name (e.g., "CUSTOM_ROLE")
 * - permisos: string[] - Array of permission strings
 * - descripcion: string - Role description
 * - activo: boolean (optional) - Default: true
 */
export async function POST(request: Request) {
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
    const { rol, permisos, descripcion, activo } = body;

    if (!rol || !permisos || !descripcion) {
      return NextResponse.json(
        { error: 'rol, permisos, and descripcion are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(permisos)) {
      return NextResponse.json(
        { error: 'permisos must be an array' },
        { status: 400 }
      );
    }

    // Check if role already exists
    const existingRole = await query(
      `SELECT "rol" FROM "ROL_PERMISOS" WHERE "rol" = $1`,
      [rol]
    );

    if (existingRole.rowCount > 0) {
      return NextResponse.json(
        { error: `Role ${rol} already exists` },
        { status: 409 }
      );
    }

    // Create role
    const insertResult = await query(
      `INSERT INTO "ROL_PERMISOS" (
        "rol",
        "permisos",
        "descripcion",
        "activo",
        "_createdDate",
        "_updatedDate"
      ) VALUES (
        $1, $2, $3, $4, NOW(), NOW()
      ) RETURNING *`,
      [
        rol,
        JSON.stringify(permisos),
        descripcion,
        activo !== undefined ? activo : true,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Role ${rol} created successfully`,
      role: insertResult.rows[0],
      permissionsCount: permisos.length,
    });
  } catch (error: any) {
    console.error('❌ Error creating role:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
