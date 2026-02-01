import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { idEstudiante } = body

    if (!idEstudiante) {
      return NextResponse.json(
        { success: false, error: 'idEstudiante is required' },
        { status: 400 }
      )
    }

    console.log('📊 [PostgreSQL] Fetching ACADEMICA data for:', idEstudiante)

    // Get student from ACADEMICA table by _id
    const studentResult = await query(
      `SELECT * FROM "ACADEMICA" WHERE "_id" = $1`,
      [idEstudiante]
    )

    if (studentResult.rows.length === 0) {
      console.log('📊 [PostgreSQL] Student not found:', idEstudiante)
      return NextResponse.json({
        success: true,
        student: null
      })
    }

    console.log('✅ [PostgreSQL] ACADEMICA data found for:', idEstudiante)

    return NextResponse.json({
      success: true,
      student: studentResult.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in academica-user API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
