import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/materials/usuario
 *
 * Get user material for a specific step (from NIVELES_MATERIAL table)
 *
 * Query params:
 * - step: string (required) - Step name (e.g., "Step 1", "Step 0")
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
    const step = searchParams.get('step');

    if (!step) {
      return NextResponse.json(
        { error: 'step query parameter is required' },
        { status: 400 }
      );
    }

    // Get material from NIVELES_MATERIAL table
    const result = await query(
      `SELECT
        "_id",
        "nivel",
        "step",
        "materialUsuario",
        "titulo",
        "descripcion",
        "orden",
        "_createdDate",
        "_updatedDate"
      FROM "NIVELES_MATERIAL"
      WHERE "step" = $1
      ORDER BY "orden" ASC`,
      [step]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({
        success: true,
        material: null,
        message: `No material found for ${step}`,
      });
    }

    return NextResponse.json({
      success: true,
      material: result.rows[0],
      allMaterials: result.rows, // In case there are multiple materials for same step
      count: result.rowCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Error fetching material usuario:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
