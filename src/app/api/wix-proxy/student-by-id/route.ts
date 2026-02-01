import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    console.log('🔍 [PostgreSQL] Student By ID: id =', id)

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      )
    }

    // Get student from ACADEMICA table
    const studentResult = await query(
      `SELECT * FROM "ACADEMICA" WHERE "_id" = $1`,
      [id]
    )

    if (studentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Student not found'
      }, { status: 404 })
    }

    const student = studentResult.rows[0]

    // Get student's classes/bookings
    const classesResult = await query(
      `SELECT ab.*, c."titulo", c."hora", c."advisor", c."tipo", c."nivel" as "calendarioNivel"
       FROM "ACADEMICA_BOOKINGS" ab
       LEFT JOIN "CALENDARIO" c ON ab."eventoId" = c."_id"
       WHERE ab."visitorId" = $1
       ORDER BY ab."dia" DESC
       LIMIT 50`,
      [id]
    )

    console.log('🔍 [PostgreSQL] Student By ID: Found student:', student.primerNombre, student.primerApellido, 'with', classesResult.rows.length, 'classes')

    return NextResponse.json({
      success: true,
      student,
      classes: classesResult.rows
    })

  } catch (error: any) {
    console.error('🔍 [PostgreSQL] Student By ID error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
