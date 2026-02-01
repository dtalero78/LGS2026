import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function PUT(request: NextRequest) {
  try {
    const eventData = await request.json()

    console.log('📝 [PostgreSQL] Updating calendar event:', eventData)

    if (!eventData._id && !eventData.eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      )
    }

    const eventId = eventData._id || eventData.eventId

    // Build dynamic update query
    const allowedFields = [
      'dia', 'fecha', 'hora', 'advisor', 'nivel', 'step', 'tipo',
      'titulo', 'nombreEvento', 'tituloONivel', 'linkZoom', 'limiteUsuarios',
      'club', 'observaciones', 'inscritos'
    ]

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      if (eventData[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`)
        values.push(eventData[field])
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
    values.push(eventId)

    const result = await query(
      `UPDATE "CALENDARIO"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Calendario event updated:', eventId)

    return NextResponse.json({
      success: true,
      event: result.rows[0],
      message: 'Evento actualizado exitosamente en CALENDARIO'
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in update-calendario-event API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}