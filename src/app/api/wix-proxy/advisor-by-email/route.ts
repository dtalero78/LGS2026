import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    console.log('🔍 [PostgreSQL] Advisor By Email:', email)

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Query ADVISORS table by email
    const result = await query(
      `SELECT * FROM "ADVISORS" WHERE LOWER("email") = LOWER($1)`,
      [email]
    )

    if (result.rowCount === 0) {
      console.log('⚠️ [PostgreSQL] Advisor no encontrado:', email)
      return NextResponse.json({
        success: false,
        error: 'Advisor no encontrado'
      }, { status: 404 })
    }

    const advisor = result.rows[0]
    console.log('✅ [PostgreSQL] Advisor encontrado:', advisor.nombreCompleto || advisor.email)

    return NextResponse.json({
      success: true,
      advisor: advisor
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Advisor By Email error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
