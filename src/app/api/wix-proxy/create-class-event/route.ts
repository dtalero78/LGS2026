import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const eventData = await request.json()
    console.log('📚 [PostgreSQL] Creating new class event:', eventData)
    console.log('👤 Agendado por:', eventData.agendadoPor, '| Rol:', eventData.agendadoPorRol)

    const {
      studentId,
      dia,
      hora,
      nivel,
      step,
      advisor,
      tipo,
      titulo,
      nombreEvento,
      linkZoom,
      agendadoPor,
      agendadoPorRol
    } = eventData

    if (!studentId || !dia) {
      return NextResponse.json(
        { success: false, error: 'studentId y dia son requeridos' },
        { status: 400 }
      )
    }

    // Generate IDs
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Extract date and time
    const diaDate = new Date(dia)
    const fecha = diaDate.toISOString().split('T')[0]

    // Create CALENDARIO event
    const calendarResult = await query(
      `INSERT INTO "CALENDARIO" (
        "_id", "dia", "fecha", "hora", "advisor", "nivel", "step", "tipo",
        "titulo", "nombreEvento", "tituloONivel", "linkZoom",
        "agendadoPor", "agendadoPorRol",
        "origen", "_createdDate", "_updatedDate"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'POSTGRES', NOW(), NOW())
      RETURNING *`,
      [
        eventId,
        diaDate.toISOString(),
        fecha,
        hora || null,
        advisor || null,
        nivel || null,
        step || null,
        tipo || 'SESSION',
        titulo || nombreEvento || `Clase ${nivel || ''} ${step || ''}`,
        nombreEvento || titulo || null,
        nivel || titulo || null,
        linkZoom || null,
        agendadoPor || null,
        agendadoPorRol || null
      ]
    )

    console.log('✅ [PostgreSQL] Class event created:', eventId)

    // Create booking for the student
    await query(
      `INSERT INTO "ACADEMICA_BOOKINGS" (
        "_id", "studentId", "eventoId", "nivel", "step",
        "origen", "_createdDate", "_updatedDate"
      ) VALUES ($1, $2, $3, $4, $5, 'POSTGRES', NOW(), NOW())`,
      [bookingId, studentId, eventId, nivel || null, step || null]
    )

    console.log('✅ [PostgreSQL] Booking created:', bookingId)

    return NextResponse.json({
      success: true,
      event: calendarResult.rows[0],
      booking: { _id: bookingId, studentId, eventoId: eventId }
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in create-class-event API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
