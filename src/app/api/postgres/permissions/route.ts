import { NextResponse } from 'next/server';
import { queryOne, queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/permissions
 * Get all roles or specific role permissions
 *
 * Query params:
 * - rol: Optional. If provided, returns permissions for that specific role
 *
 * Examples:
 * - GET /api/postgres/permissions?rol=ADMIN
 * - GET /api/postgres/permissions (returns all roles)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rol = searchParams.get('rol');

    if (rol) {
      // Get specific role permissions
      const result = await queryOne(
        `SELECT "rol", "permisos", "descripcion", "activo"
         FROM "ROL_PERMISOS"
         WHERE "rol" = $1`,
        [rol]
      );

      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Role not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        rol: result.rol,
        permisos: result.permisos, // Already parsed as array by PostgreSQL
        descripcion: result.descripcion,
      });
    } else {
      // Get all roles
      const results = await queryMany(
        `SELECT "rol", "permisos", "descripcion", "activo"
         FROM "ROL_PERMISOS"
         WHERE "activo" = true
         ORDER BY "rol"`
      );

      return NextResponse.json({
        success: true,
        roles: results,
      });
    }
  } catch (error: any) {
    console.error('❌ Error getting permissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
