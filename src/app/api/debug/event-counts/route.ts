import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 DEBUG [PostgreSQL]: Comparing counts for event:', eventId)

    // Get all bookings for the event (modal view)
    const bookingsResult = await query(
      `SELECT
        ab.*,
        p."primerNombre",
        p."primerApellido",
        p."nivel",
        p."step"
      FROM "ACADEMICA_BOOKINGS" ab
      LEFT JOIN "PEOPLE" p ON ab."visitorId" = p."_id"
      WHERE ab."eventoId" = $1
      ORDER BY ab."_createdDate" DESC`,
      [eventId]
    )

    // Get count for the event (general view)
    const countResult = await query(
      `SELECT COUNT(*) as count FROM "ACADEMICA_BOOKINGS" WHERE "eventoId" = $1`,
      [eventId]
    )

    const bookings = bookingsResult.rows
    const modalCount = bookings.length
    const generalCount = parseInt(countResult.rows[0]?.count || '0', 10)

    console.log('🔍 DEBUG [PostgreSQL] Results:')
    console.log('  Modal count (bookings):', modalCount)
    console.log('  General count (count query):', generalCount)
    console.log('  Bookings preview:', bookings.slice(0, 3))

    return NextResponse.json({
      success: true,
      eventId,
      modalCount,
      generalCount,
      difference: modalCount - generalCount,
      bookingsPreview: bookings.slice(0, 3),
      source: 'postgres'
    })

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}