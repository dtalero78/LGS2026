import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/postgres'

/**
 * Get Student Full Profile (PostgreSQL)
 * Returns complete student information from PEOPLE table
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 [PostgreSQL] Getting student profile:', id)

    // First try ACADEMICA (for beneficiaries/students)
    let student = await queryOne(
      `SELECT
        a."_id",
        a."numeroId",
        a."primerNombre",
        a."segundoNombre",
        a."primerApellido",
        a."segundoApellido",
        p."celular",
        p."telefono",
        p."email",
        p."domicilio",
        p."ciudad",
        p."fechaNacimiento",
        p."contrato",
        a."vigencia",
        a."fechaCreacion",
        p."tipoUsuario",
        a."plataforma",
        a."nivel",
        a."step",
        a."nivelParalelo",
        a."stepParalelo",
        p."aprobacion",
        a."estadoInactivo",
        p."estado",
        p."fechaOnHold",
        p."fechaFinOnHold",
        p."vigenciaOriginalPreOnHold",
        p."onHoldCount",
        p."onHoldHistory",
        a."extensionCount",
        a."extensionHistory",
        a."fechaContrato",
        a."finalContrato",
        p."titularId",
        a."asesor",
        a."usuarioId",
        p."ingresos",
        p."genero",
        p."empresa",
        p."cargo",
        p."referenciaUno",
        p."parentezcoRefUno",
        p."telefonoRefUno",
        p."referenciaDos",
        p."parentezcoRefDos",
        p."telefonoRefDos",
        a."_createdDate",
        a."_updatedDate"
      FROM "ACADEMICA" a
      LEFT JOIN "PEOPLE" p ON a."numeroId" = p."numeroId"
      WHERE a."_id" = $1`,
      [id]
    )

    // If not found in ACADEMICA, try PEOPLE (for titulares)
    if (!student) {
      student = await queryOne(
        `SELECT
          "_id",
          "numeroId",
          "primerNombre",
          "segundoNombre",
          "primerApellido",
          "segundoApellido",
          "celular",
          "telefono",
          "email",
          "domicilio",
          "ciudad",
          "fechaNacimiento",
          "contrato",
          "vigencia",
          "fechaCreacion",
          "tipoUsuario",
          "plataforma",
          "nivel",
          "step",
          "nivelParalelo",
          "stepParalelo",
          "aprobacion",
          "estadoInactivo",
          "estado",
          "fechaOnHold",
          "fechaFinOnHold",
          "vigenciaOriginalPreOnHold",
          "onHoldCount",
          "onHoldHistory",
          "extensionCount",
          "extensionHistory",
          "fechaContrato",
          "finalContrato",
          "titularId",
          "asesor",
          "usuarioId",
          "ingresos",
          "genero",
          "empresa",
          "cargo",
          "referenciaUno",
          "parentezcoRefUno",
          "telefonoRefUno",
          "referenciaDos",
          "parentezcoRefDos",
          "telefonoRefDos",
          "_createdDate",
          "_updatedDate"
        FROM "PEOPLE"
        WHERE "_id" = $1`,
        [id]
      )
    }

    if (!student) {
      console.log('⚠️ [PostgreSQL] Student not found in ACADEMICA or PEOPLE:', id)
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Student profile loaded:', student.primerNombre, student.primerApellido)

    return NextResponse.json({
      success: true,
      data: student,
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error getting student profile:', error)
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
