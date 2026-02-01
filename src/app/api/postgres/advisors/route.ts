import { NextRequest, NextResponse } from 'next/server'
import { queryMany } from '@/lib/postgres'

/**
 * Get Advisors List (PostgreSQL)
 * Returns list of active users with ADVISOR or ADMIN roles
 */
async function getAdvisors(includeInactive: boolean = false) {
  console.log('🔍 [PostgreSQL Advisors] Getting advisors list, includeInactive:', includeInactive)

  const query = `
    SELECT
      "_id",
      "email",
      "nombre",
      "rol",
      "activo",
      "_createdDate",
      "_updatedDate"
    FROM "USUARIOS_ROLES"
    WHERE ("rol" = 'ADVISOR' OR "rol" = 'ADMIN' OR "rol" = 'SUPER_ADMIN')
    ${includeInactive ? '' : 'AND "activo" = true'}
    ORDER BY "nombre" ASC
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
      data: advisors,
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
      data: advisors,
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
