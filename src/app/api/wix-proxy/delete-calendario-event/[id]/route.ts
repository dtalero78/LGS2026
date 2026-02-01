import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id

    console.log('🗑️ [PostgreSQL] Deleting calendar event:', eventId)

    // First, delete all bookings for this event
    await query(
      `DELETE FROM "ACADEMICA_BOOKINGS" WHERE "eventoId" = $1`,
      [eventId]
    )

    // Then delete the event
    const result = await query(
      `DELETE FROM "CALENDARIO" WHERE "_id" = $1 RETURNING "_id"`,
      [eventId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Calendario event deleted:', eventId)

    return NextResponse.json({
      success: true,
      message: 'Evento eliminado exitosamente de CALENDARIO'
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in delete-calendario-event API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
