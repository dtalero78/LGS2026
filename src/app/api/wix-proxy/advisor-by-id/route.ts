import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const advisorId = searchParams.get('id')

    console.log('👨‍🏫 [PostgreSQL] Fetching advisor by ID:', advisorId)

    if (!advisorId) {
      return NextResponse.json(
        { success: false, error: 'Advisor ID is required' },
        { status: 400 }
      )
    }

    const result = await query(
      `SELECT * FROM "ADVISORS" WHERE "_id" = $1`,
      [advisorId]
    )

    if (result.rowCount === 0) {
      console.log('⚠️ [PostgreSQL] Advisor no encontrado:', advisorId)
      return NextResponse.json(
        { success: false, error: 'Advisor no encontrado' },
        { status: 404 }
      )
    }

    const advisor = result.rows[0]
    console.log('✅ [PostgreSQL] Advisor encontrado:', advisor.nombreCompleto || 'Unknown')

    return NextResponse.json({
      success: true,
      advisor: advisor
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in advisor-by-id API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
