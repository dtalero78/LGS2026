import { NextRequest, NextResponse } from 'next/server'
import { queryMany } from '@/lib/postgres'

/**
 * Unified Search Endpoint (PostgreSQL)
 * Searches in PEOPLE and ACADEMICA tables by:
 * - primerNombre (first name)
 * - primerApellido (last name)
 * - numeroId (document)
 * - contrato (contract number)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('searchTerm') || searchParams.get('q')

    if (!searchTerm || searchTerm.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Search term must be at least 2 characters',
        data: { people: [], academica: [] },
        totalCount: 0,
      }, { status: 400 })
    }

    const term = searchTerm.trim()
    const termPattern = `%${term}%`

    console.log('🔍 [PostgreSQL Search] Searching for:', term)

    // Search in PEOPLE table
    const peopleQuery = `
      SELECT
        "_id",
        "numeroId",
        "primerNombre",
        "segundoNombre",
        "primerApellido",
        "segundoApellido",
        "tipoUsuario",
        "email",
        "contrato",
        "nivel",
        "step",
        "estadoInactivo",
        "vigencia",
        "finalContrato"
      FROM "PEOPLE"
      WHERE
        (LOWER("primerNombre") LIKE LOWER($1) OR
         LOWER("primerApellido") LIKE LOWER($1) OR
         "numeroId" LIKE $1 OR
         "contrato" LIKE $1)
      ORDER BY "primerNombre", "primerApellido"
      LIMIT 100
    `

    const people = await queryMany(peopleQuery, [termPattern])
    console.log('🔍 [PostgreSQL Search] Found in PEOPLE:', people.length)

    // Search in ACADEMICA table
    const academicaQuery = `
      SELECT
        a."_id",
        a."numeroId",
        a."nivel",
        a."step",
        a."nivelParalelo",
        a."stepParalelo",
        p."primerNombre",
        p."segundoNombre",
        p."primerApellido",
        p."segundoApellido",
        p."tipoUsuario",
        p."email",
        p."contrato"
      FROM "ACADEMICA" a
      INNER JOIN "PEOPLE" p ON a."numeroId" = p."numeroId"
      WHERE
        (LOWER(p."primerNombre") LIKE LOWER($1) OR
         LOWER(p."primerApellido") LIKE LOWER($1) OR
         a."numeroId" LIKE $1 OR
         p."contrato" LIKE $1)
      ORDER BY p."primerNombre", p."primerApellido"
      LIMIT 100
    `

    const academica = await queryMany(academicaQuery, [termPattern])
    console.log('🔍 [PostgreSQL Search] Found in ACADEMICA:', academica.length)

    const totalCount = people.length + academica.length
    console.log('🔍 [PostgreSQL Search] Total results:', totalCount)

    return NextResponse.json({
      success: true,
      data: {
        people,
        academica,
      },
      totalCount,
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL Search] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Database error',
      details: error.message,
      data: { people: [], academica: [] },
      totalCount: 0,
    }, { status: 500 })
  }
}
