import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('id')

    if (!classId) {
      return NextResponse.json(
        { success: false, error: 'Class ID parameter is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    console.log('🔄 [PostgreSQL] Updating class:', classId, body)

    // Build dynamic update query
    const allowedFields = [
      'asistio', 'asistencia', 'participacion', 'calificacion',
      'noAprobo', 'cancelo', 'comentario', 'comentarioAdvisor',
      'comentarioEstudiante', 'evaluacion'
    ]

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`)
        values.push(body[field])
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Add _updatedDate
    updates.push(`"_updatedDate" = NOW()`)
    values.push(classId)

    const result = await query(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Class record not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Class updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully',
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in update-class API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
