import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/users/[email]/role
 *
 * Get role for a specific user
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

    const email = decodeURIComponent(params.email);

    const result = await query(
      `SELECT
        "email",
        "rol",
        "activo",
        "_createdDate",
        "_updatedDate"
      FROM "USUARIOS_ROLES"
      WHERE "email" = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    // Get role permissions
    const roleResult = await query(
      `SELECT "permisos", "descripcion" FROM "ROL_PERMISOS" WHERE "rol" = $1`,
      [user.rol]
    );

    const roleData = roleResult.rows[0] || { permisos: [], descripcion: '' };

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        rol: user.rol,
        activo: user.activo,
      },
      permissions: roleData.permisos || [],
      roleDescription: roleData.descripcion,
    });
  } catch (error: any) {
    console.error('❌ Error fetching user role:', error);
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
 * PUT /api/postgres/users/[email]/role
 *
 * Update role for a specific user
 *
 * Body:
 * - rol: string - New role name
 */
export async function PUT(
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

    const body = await request.json();
    const { rol } = body;
    const email = decodeURIComponent(params.email);

    if (!rol) {
      return NextResponse.json(
        { error: 'rol is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const userCheck = await query(
      `SELECT "email" FROM "USUARIOS_ROLES" WHERE "email" = $1`,
      [email]
    );

    if (userCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if role exists
    const roleCheck = await query(
      `SELECT "rol" FROM "ROL_PERMISOS" WHERE "rol" = $1`,
      [rol]
    );

    if (roleCheck.rowCount === 0) {
      return NextResponse.json(
        { error: `Role ${rol} does not exist` },
        { status: 404 }
      );
    }

    // Update user role
    const updateResult = await query(
      `UPDATE "USUARIOS_ROLES"
       SET "rol" = $1,
           "_updatedDate" = NOW()
       WHERE "email" = $2
       RETURNING *`,
      [rol, email]
    );

    return NextResponse.json({
      success: true,
      message: `Role updated to ${rol} for user ${email}`,
      user: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error updating user role:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
