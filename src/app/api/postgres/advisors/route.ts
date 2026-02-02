import { NextRequest, NextResponse } from 'next/server'
import { queryMany } from '@/lib/postgres'

/**
 * Get Advisors List (PostgreSQL)
 * Returns list of advisors from the ADVISORS table (migrated from Wix)
 * This table contains the advisors that are used in CALENDARIO events
 */
async function getAdvisors(includeInactive: boolean = false) {
  console.log('🔍 [PostgreSQL Advisors] Getting advisors list from ADVISORS table, includeInactive:', includeInactive)

  const query = `
    SELECT
      "_id",
      "email",
      "primerNombre",
      "primerApellido",
      "nombreCompleto",
      "pais",
      "zoom",
      "activo",
      "_createdDate",
      "_updatedDate"
    FROM "ADVISORS"
    ${includeInactive ? '' : 'WHERE "activo" = true OR "activo" IS NULL'}
    ORDER BY "nombreCompleto" ASC NULLS LAST
  `

  const advisors = await queryMany(query, [])

  console.log('✅ [PostgreSQL Advisors] Found', advisors.length, 'advisors')

  return advisors
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const advisors = await getAdvisors(includeInactive)

    return NextResponse.json({
      success: true,
      advisors: advisors,
      data: advisors, // For backwards compatibility
      total: advisors.length,
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL Advisors] Error:', error)
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

// POST handler for frontend compatibility
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const includeInactive = body.includeInactive === true
    const advisors = await getAdvisors(includeInactive)

    return NextResponse.json({
      success: true,
      advisors: advisors,
      data: advisors, // For backwards compatibility
      total: advisors.length,
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL Advisors] Error:', error)
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
