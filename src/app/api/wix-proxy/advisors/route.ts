import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    console.log('👨‍🏫 [PostgreSQL] Fetching advisors')

    const result = await query(`
      SELECT * FROM "ADVISORS"
      WHERE "activo" = true OR "activo" IS NULL
      ORDER BY "nombreCompleto"
    `)

    console.log('✅ [PostgreSQL] Advisors received:', result.rows.length)

    return NextResponse.json({
      success: true,
      advisors: result.rows
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in advisors API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
