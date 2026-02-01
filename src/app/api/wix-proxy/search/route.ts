import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('searchTerm')

    console.log('🔍 [PostgreSQL] Search: searchTerm =', searchTerm)

    if (!searchTerm) {
      return NextResponse.json(
        { error: 'searchTerm parameter is required' },
        { status: 400 }
      )
    }

    const searchPattern = `%${searchTerm}%`

    // Search in PEOPLE table
    const peopleResult = await query(`
      SELECT * FROM "PEOPLE"
      WHERE "primerNombre" ILIKE $1
         OR "segundoNombre" ILIKE $1
         OR "primerApellido" ILIKE $1
         OR "segundoApellido" ILIKE $1
         OR "numeroId" ILIKE $1
         OR "email" ILIKE $1
         OR "contrato" ILIKE $1
         OR "celular" ILIKE $1
      ORDER BY "primerApellido", "primerNombre"
      LIMIT 100
    `, [searchPattern])

    // Search in ACADEMICA table
    const academicaResult = await query(`
      SELECT * FROM "ACADEMICA"
      WHERE "primerNombre" ILIKE $1
         OR "segundoNombre" ILIKE $1
         OR "primerApellido" ILIKE $1
         OR "segundoApellido" ILIKE $1
         OR "numeroId" ILIKE $1
         OR "email" ILIKE $1
      ORDER BY "primerApellido", "primerNombre"
      LIMIT 100
    `, [searchPattern])

    console.log('🔍 [PostgreSQL] Search: Found', peopleResult.rows.length, 'people,', academicaResult.rows.length, 'academica')

    return NextResponse.json({
      success: true,
      data: {
        people: peopleResult.rows,
        academica: academicaResult.rows
      },
      totalCount: peopleResult.rows.length + academicaResult.rows.length
    })

  } catch (error: any) {
    console.error('🔍 [PostgreSQL] Search error:', error)
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: error.message || 'Internal server error'
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query: searchQuery, tipoUsuario } = body

    console.log('🔍 [PostgreSQL] Search POST: query =', searchQuery)
    console.log('🔍 [PostgreSQL] Search POST: tipoUsuario =', tipoUsuario)

    let peopleResult
    let academicaResult

    if (tipoUsuario && (!searchQuery || searchQuery.trim() === '')) {
      // Get all users of a specific type
      console.log('🔍 [PostgreSQL] Search POST: Getting all users of type =', tipoUsuario)

      peopleResult = await query(`
        SELECT * FROM "PEOPLE"
        WHERE "tipoUsuario" = $1
        ORDER BY "primerApellido", "primerNombre"
        LIMIT 100
      `, [tipoUsuario])

      academicaResult = { rows: [] }
    } else if (searchQuery && searchQuery.trim() !== '') {
      const searchPattern = `%${searchQuery}%`

      // Build query with optional tipoUsuario filter
      let peopleQuery = `
        SELECT * FROM "PEOPLE"
        WHERE ("primerNombre" ILIKE $1
           OR "segundoNombre" ILIKE $1
           OR "primerApellido" ILIKE $1
           OR "segundoApellido" ILIKE $1
           OR "numeroId" ILIKE $1
           OR "email" ILIKE $1
           OR "contrato" ILIKE $1
           OR "celular" ILIKE $1)
      `

      if (tipoUsuario) {
        peopleQuery += ` AND "tipoUsuario" = $2`
        peopleResult = await query(peopleQuery + ` ORDER BY "primerApellido", "primerNombre" LIMIT 100`, [searchPattern, tipoUsuario])
      } else {
        peopleResult = await query(peopleQuery + ` ORDER BY "primerApellido", "primerNombre" LIMIT 100`, [searchPattern])
      }

      academicaResult = await query(`
        SELECT * FROM "ACADEMICA"
        WHERE "primerNombre" ILIKE $1
           OR "segundoNombre" ILIKE $1
           OR "primerApellido" ILIKE $1
           OR "segundoApellido" ILIKE $1
           OR "numeroId" ILIKE $1
           OR "email" ILIKE $1
        ORDER BY "primerApellido", "primerNombre"
        LIMIT 100
      `, [searchPattern])
    } else {
      // No search criteria
      peopleResult = { rows: [] }
      academicaResult = { rows: [] }
    }

    console.log('🔍 [PostgreSQL] Search POST: Found', peopleResult.rows.length, 'people')

    return NextResponse.json({
      success: true,
      data: {
        people: peopleResult.rows,
        academica: academicaResult.rows
      },
      totalCount: peopleResult.rows.length + academicaResult.rows.length
    })

  } catch (error: any) {
    console.error('🔍 [PostgreSQL] Search POST error:', error)
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: error.message || 'Internal server error'
    })
  }
}