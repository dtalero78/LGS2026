import { NextRequest, NextResponse } from 'next/server'
import { queryMany } from '@/lib/postgres'

/**
 * Get All Levels (PostgreSQL)
 * Returns list of all levels from NIVELES table
 * Query parameters:
 * - includeInactive: boolean (optional, defaults to false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    console.log('🔍 [PostgreSQL Niveles] Getting levels list')

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
      ORDER BY "orden" ASC NULLS LAST, "code" ASC
    `

    const levels = await queryMany(query, [])

    console.log('✅ [PostgreSQL Niveles] Found', levels.length, 'levels')

    return NextResponse.json({
      success: true,
      data: levels,
      total: levels.length,
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
