import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      idEstudiante,
      idEvento,
      asistencia,
      participacion,
      noAprobo,
      calificacion,
      comentarios,
      advisorAnotaciones,
      actividadPropuesta,
      nivel,
      step
    } = body

    console.log('📝 [PostgreSQL] Update Class Record:', {
      idEstudiante,
      idEvento,
      asistencia,
      participacion,
      noAprobo,
      calificacion
    })

    if (!idEstudiante || !idEvento) {
      return NextResponse.json(
        { error: 'idEstudiante and idEvento are required' },
        { status: 400 }
      )
    }

    // Find the booking record
    const existingBooking = await query(
      `SELECT * FROM "ACADEMICA_BOOKINGS"
       WHERE "studentId" = $1 AND "eventoId" = $2`,
      [idEstudiante, idEvento]
    )

    if (existingBooking.rowCount === 0) {
      // Create a new booking record if it doesn't exist
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const result = await query(
        `INSERT INTO "ACADEMICA_BOOKINGS" (
          "_id", "studentId", "eventoId", "asistio", "asistencia",
          "participacion", "noAprobo", "calificacion", "comentario",
          "comentarioAdvisor", "nivel", "step",
          "origen", "_createdDate", "_updatedDate"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'POSTGRES', NOW(), NOW())
        RETURNING *`,
        [
          bookingId,
          idEstudiante,
          idEvento,
          asistencia === true || asistencia === 'true',
          asistencia === true || asistencia === 'true',
          participacion || null,
          noAprobo === true || noAprobo === 'true',
          calificacion || null,
          comentarios || null,
          advisorAnotaciones || null,
          nivel || null,
          step || null
        ]
      )

      console.log('✅ [PostgreSQL] Class record created')

      return NextResponse.json({
        success: true,
        data: result.rows[0]
      })
    }

    // Update existing record
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (asistencia !== undefined) {
      updates.push(`"asistio" = $${paramIndex}`)
      values.push(asistencia === true || asistencia === 'true')
      paramIndex++
      updates.push(`"asistencia" = $${paramIndex}`)
      values.push(asistencia === true || asistencia === 'true')
      paramIndex++
    }

    if (participacion !== undefined) {
      updates.push(`"participacion" = $${paramIndex}`)
      values.push(participacion)
      paramIndex++
    }

    if (noAprobo !== undefined) {
      updates.push(`"noAprobo" = $${paramIndex}`)
      values.push(noAprobo === true || noAprobo === 'true')
      paramIndex++
    }

    if (calificacion !== undefined) {
      updates.push(`"calificacion" = $${paramIndex}`)
      values.push(calificacion)
      paramIndex++
    }

    if (comentarios !== undefined) {
      updates.push(`"comentario" = $${paramIndex}`)
      values.push(comentarios)
      paramIndex++
    }

    if (advisorAnotaciones !== undefined) {
      updates.push(`"comentarioAdvisor" = $${paramIndex}`)
      values.push(advisorAnotaciones)
      paramIndex++
    }

    if (actividadPropuesta !== undefined) {
      updates.push(`"actividadPropuesta" = $${paramIndex}`)
      values.push(actividadPropuesta)
      paramIndex++
    }

    if (nivel !== undefined) {
      updates.push(`"nivel" = $${paramIndex}`)
      values.push(nivel)
      paramIndex++
    }

    if (step !== undefined) {
      updates.push(`"step" = $${paramIndex}`)
      values.push(step)
      paramIndex++
    }

    updates.push(`"_updatedDate" = NOW()`)

    values.push(idEstudiante)
    values.push(idEvento)

    const result = await query(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET ${updates.join(', ')}
       WHERE "studentId" = $${paramIndex} AND "eventoId" = $${paramIndex + 1}
       RETURNING *`,
      values
    )

    console.log('✅ [PostgreSQL] Class record updated')

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Update Class Record error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
