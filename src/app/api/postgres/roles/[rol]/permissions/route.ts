import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/roles/[rol]/permissions
 *
 * Get permissions for a specific role
 */
export async function GET(
  request: Request,
  { params }: { params: { rol: string } }
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

    const rol = decodeURIComponent(params.rol);

    const result = await query(
      `SELECT
        "rol",
        "permisos",
        "descripcion",
        "activo",
        "_createdDate",
        "_updatedDate"
      FROM "ROL_PERMISOS"
      WHERE "rol" = $1`,
      [rol]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    const roleData = result.rows[0];

    return NextResponse.json({
      success: true,
      rol: roleData.rol,
      permisos: roleData.permisos || [],
      descripcion: roleData.descripcion,
      activo: roleData.activo,
    });
  } catch (error: any) {
    console.error('❌ Error fetching role permissions:', error);
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
 * PUT /api/postgres/roles/[rol]/permissions
 *
 * Update permissions for a specific role
 *
 * Body:
 * - permisos: string[] - Array of permission strings
 * - descripcion: string (optional) - Role description
 */
export async function PUT(
  request: Request,
  { params }: { params: { rol: string } }
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
    const { permisos, descripcion } = body;
    const rol = decodeURIComponent(params.rol);

    if (!permisos || !Array.isArray(permisos)) {
      return NextResponse.json(
        { error: 'permisos array is required' },
        { status: 400 }
      );
    }

    // Check if role exists
    const roleCheck = await query(
      `SELECT "rol" FROM "ROL_PERMISOS" WHERE "rol" = $1`,
      [rol]
    );

    if (roleCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Update role permissions
    const updates: string[] = [`"permisos" = $1`];
    const values: any[] = [JSON.stringify(permisos)];
    let paramIndex = 2;

    if (descripcion !== undefined) {
      updates.push(`"descripcion" = $${paramIndex}`);
      values.push(descripcion);
      paramIndex++;
    }

    updates.push(`"_updatedDate" = NOW()`);
    values.push(rol);

    const updateResult = await query(
      `UPDATE "ROL_PERMISOS"
       SET ${updates.join(', ')}
       WHERE "rol" = $${paramIndex}
       RETURNING *`,
      values
    );

    return NextResponse.json({
      success: true,
      message: `Permissions updated for role ${rol}`,
      role: updateResult.rows[0],
      permissionsCount: permisos.length,
    });
  } catch (error: any) {
    console.error('❌ Error updating role permissions:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
