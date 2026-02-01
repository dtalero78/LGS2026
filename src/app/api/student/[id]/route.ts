import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id

    if (!studentId) {
      return NextResponse.json({
        success: false,
        error: 'Student ID is required'
      }, { status: 400 })
    }

    console.log('📚 [PostgreSQL] Fetching student:', studentId)

    // Get student data from PostgreSQL
    const studentResult = await query(
      `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
      [studentId]
    )

    if (studentResult.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Student not found',
        source: 'postgres'
      }, { status: 404 })
    }

    const student = studentResult.rows[0]

    // Get classes for the student
    const classesResult = await query(
      `SELECT
        ab.*,
        c."dia",
        c."hora",
        c."tipo",
        c."nivel" as "eventoNivel",
        c."step" as "eventoStep",
        c."descripcion",
        c."advisor"
      FROM "ACADEMICA_BOOKINGS" ab
      LEFT JOIN "CALENDARIO" c ON ab."eventoId" = c."_id"
      WHERE ab."visitorId" = $1
      ORDER BY c."dia" DESC`,
      [studentId]
    )

    console.log('✅ [PostgreSQL] Student found with', classesResult.rowCount, 'classes')

    return NextResponse.json({
      success: true,
      student: student,
      classes: classesResult.rows || [],
      source: 'postgres'
    })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error fetching student:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
