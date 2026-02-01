import { NextRequest, NextResponse } from 'next/server'
import { queryMany } from '@/lib/postgres'

/**
 * Get Steps for a Specific Level (PostgreSQL)
 * Returns all steps/records for a given level code
 * URL: /api/postgres/niveles/BN1 (returns all BN1 steps)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { codigo: string } }
) {
  try {
    const { codigo } = params

    if (!codigo) {
      return NextResponse.json(
        { success: false, error: 'Level code is required' },
        { status: 400 }
      )
    }

    console.log('🔍 [PostgreSQL Niveles] Getting steps for level:', codigo)

    const query = `
      SELECT
        "_id",
        "code",
        "step",
        "description",
        "esParalelo",
        "material",
        "clubs",
        "steps",
        "materiales",
        "orden",
        "_createdDate",
        "_updatedDate"
      FROM "NIVELES"
      WHERE "code" = $1
      ORDER BY "orden" ASC NULLS LAST, "step" ASC
    `

    const steps = await queryMany(query, [codigo])

    if (steps.length === 0) {
      console.log('⚠️ [PostgreSQL Niveles] Level not found:', codigo)
      return NextResponse.json(
        { success: false, error: 'Level not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL Niveles] Found', steps.length, 'steps for', codigo)

    return NextResponse.json({
      success: true,
      data: {
        nivel: codigo,
        esParalelo: steps[0].esParalelo,
        totalSteps: steps.length,
        steps: steps,
      },
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL Niveles] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
