import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryMany } from '@/lib/postgres'

/**
 * Get Student Academic History (PostgreSQL)
 * Returns:
 * - Academic record from ACADEMICA table
 * - Class history from ACADEMICA_BOOKINGS table
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 [PostgreSQL] Getting academic history for student:', id)

    // Get academic record from ACADEMICA
    // Search by multiple ID fields to handle different ID formats
    const academicRecord = await queryOne(
      `SELECT
        "_id",
        "studentId",
        "numeroId",
        "nivel",
        "step",
        "nivelParalelo",
        "stepParalelo",
        "primerNombre",
        "segundoNombre",
        "primerApellido",
        "segundoApellido",
        "asesor",
        "fechaNacimiento",
        "celular",
        "telefono",
        "email",
        "contrato",
        "fechaCreacion",
        "tipoUsuario",
        "plataforma",
        "usuarioId",
        "peopleId",
        "estadoInactivo",
        "fechaContrato",
        "finalContrato",
        "vigencia",
        "extensionCount",
        "extensionHistory",
        "onHoldCount"
      FROM "ACADEMICA"
      WHERE "_id" = $1 OR "studentId" = $1 OR "peopleId" = $1 OR "numeroId" = $1`,
      [id]
    )

    if (!academicRecord) {
      console.log('⚠️ [PostgreSQL] Academic record not found for:', id)
      return NextResponse.json(
        { success: false, error: 'Academic record not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Academic record loaded:', academicRecord.primerNombre, academicRecord.primerApellido)

    // Get class history from ACADEMICA_BOOKINGS
    // Search by multiple possible ID fields: studentId, peopleId from ACADEMICA, or the _id itself
    const studentIdToSearch = academicRecord.studentId || academicRecord.peopleId || academicRecord._id || id
    console.log('🔍 [PostgreSQL] Searching bookings with studentId:', studentIdToSearch)

    const classes = await queryMany(
      `SELECT
        "_id",
        "studentId",
        "eventoId",
        "tipo",
        "fecha",
        "hora",
        "advisor",
        "nivel",
        "step",
        "asistencia",
        "asistio",
        "participacion",
        "noAprobo",
        "cancelo",
        "calificacion",
        "anotaciones",
        "comentarios",
        "advisorAnotaciones",
        "actividadPropuesta",
        "linkZoom",
        "asignadoPor",
        "origen",
        "agendadoPor",
        "agendadoPorEmail",
        "agendadoPorRol",
        "fechaAgendamiento",
        "fechaEvento",
        "tipoEvento",
        "nombreEvento",
        "tituloONivel",
        "_createdDate",
        "_updatedDate"
      FROM "ACADEMICA_BOOKINGS"
      WHERE "studentId" = $1
      ORDER BY "fecha" DESC, "hora" DESC
      LIMIT $2`,
      [studentIdToSearch, limit]
    )

    console.log('✅ [PostgreSQL] Found', classes.length, 'classes for student')

    return NextResponse.json({
      success: true,
      data: {
        academicRecord,
        classes,
        totalClasses: classes.length,
      },
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error getting academic history:', error)
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
