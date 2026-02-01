import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personId, tipoUsuario, titularId } = body

    console.log('🔍 [PostgreSQL] Related Persons:', { personId, tipoUsuario, titularId })

    if (!personId) {
      return NextResponse.json(
        { error: 'personId is required' },
        { status: 400 }
      )
    }

    // First get the person to find their contract
    const personResult = await query(
      `SELECT "contrato", "tipoUsuario" FROM "PEOPLE" WHERE "_id" = $1`,
      [personId]
    )

    if (personResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        relatedPersons: []
      })
    }

    const person = personResult.rows[0]
    const contrato = person.contrato

    if (!contrato) {
      return NextResponse.json({
        success: true,
        relatedPersons: []
      })
    }

    // Get all related persons with the same contract (excluding the current person)
    const relatedResult = await query(
      `SELECT * FROM "PEOPLE"
       WHERE "contrato" = $1 AND "_id" != $2
       ORDER BY "tipoUsuario" DESC, "primerApellido", "primerNombre"`,
      [contrato, personId]
    )

    console.log('🔍 [PostgreSQL] Related Persons: Found', relatedResult.rows.length, 'related persons')

    return NextResponse.json({
      success: true,
      relatedPersons: relatedResult.rows
    })

  } catch (error: any) {
    console.error('🔍 [PostgreSQL] Related Persons error:', error)
    return NextResponse.json({
      success: false,
      relatedPersons: [],
      error: error.message || 'Internal server error'
    })
  }
}
