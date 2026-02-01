import { NextRequest, NextResponse } from 'next/server'
import { queryMany } from '@/lib/postgres'

/**
 * Get Bookings/Enrollments for a Calendar Event (PostgreSQL)
 * Returns all students enrolled in a specific event from ACADEMICA_BOOKINGS
 * Query parameters:
 * - limit: Max results (default 500)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '500')

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 [PostgreSQL Calendar Bookings] Getting bookings for event:', eventId)

    const query = `
      SELECT
        ab."_id",
        ab."studentId",
        ab."eventoId",
        ab."tipo",
        ab."fecha",
        ab."hora",
        ab."advisor",
        ab."nivel",
        ab."step",
        ab."asistencia",
        ab."asistio",
        ab."participacion",
        ab."noAprobo",
        ab."cancelo",
        ab."calificacion",
        ab."anotaciones",
        ab."comentarios",
        ab."advisorAnotaciones",
        ab."actividadPropuesta",
        ab."linkZoom",
        ab."asignadoPor",
        ab."origen",
        ab."agendadoPor",
        ab."agendadoPorEmail",
        ab."agendadoPorRol",
        ab."fechaAgendamiento",
        ab."fechaEvento",
        ab."tipoEvento",
        ab."nombreEvento",
        ab."tituloONivel",
        ab."_createdDate",
        ab."_updatedDate",
        p."primerNombre",
        p."segundoNombre",
        p."primerApellido",
        p."segundoApellido",
        p."email",
        p."celular",
        p."numeroId",
        p."tipoUsuario"
      FROM "ACADEMICA_BOOKINGS" ab
      LEFT JOIN "PEOPLE" p ON ab."studentId" = p."_id"
      WHERE ab."eventoId" = $1
      ORDER BY p."primerNombre" ASC, p."primerApellido" ASC
      LIMIT $2
    `

    const bookings = await queryMany(query, [eventId, limit])

    console.log('✅ [PostgreSQL Calendar Bookings] Found', bookings.length, 'bookings')

    return NextResponse.json({
      success: true,
      data: bookings,
      total: bookings.length,
      eventId: eventId,
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL Calendar Bookings] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
