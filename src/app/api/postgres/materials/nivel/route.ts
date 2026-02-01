import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/materials/nivel
 *
 * Get nivel material for a specific step (from NIVELES table)
 *
 * Query params:
 * - step: string (required) - Step name (e.g., "Step1", "Step 1")
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

    // Normalize step format (handle both "Step1" and "Step 1")
    let normalizedStep = step;
    if (!step.includes(' ')) {
      // "Step1" -> "Step 1"
      normalizedStep = step.replace(/^Step(\d+)$/, 'Step $1');
    }

    // Get material from NIVELES table
    const result = await query(
      `SELECT
        "_id",
        "code",
        "step",
        "material",
        "description",
        "clubs",
        "steps",
        "esParalelo",
        "_createdDate",
        "_updatedDate"
      FROM "NIVELES"
      WHERE "step" = $1 OR "step" = $2
      LIMIT 1`,
      [step, normalizedStep]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({
        success: true,
        material: null,
        message: `No material found for ${step}`,
      });
    }

    const nivel = result.rows[0];

    return NextResponse.json({
      success: true,
      nivel: nivel.code,
      step: nivel.step,
      material: nivel.material,
      description: nivel.description,
      clubs: nivel.clubs,
      esParalelo: nivel.esParalelo,
    });
  } catch (error: any) {
    console.error('❌ Error fetching material nivel:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
