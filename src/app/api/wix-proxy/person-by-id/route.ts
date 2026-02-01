import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    console.log('🔍 [PostgreSQL] Person By ID: id =', id)

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      )
    }

    // Get person from PEOPLE table
    const personResult = await query(
      `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
      [id]
    )

    if (personResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Person not found'
      }, { status: 404 })
    }

    const person = personResult.rows[0]

    // Get related financial data if this is a TITULAR
    let financialData = null
    if (person.tipoUsuario === 'TITULAR' && person.contrato) {
      const financialResult = await query(
        `SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1 ORDER BY "_createdDate" DESC LIMIT 1`,
        [person.contrato]
      )
      if (financialResult.rows.length > 0) {
        financialData = financialResult.rows[0]
      }
    }

    // Get related persons (beneficiaries if TITULAR, or titular if BENEFICIARIO)
    let relatedPersons: any[] = []
    if (person.contrato) {
      const relatedResult = await query(
        `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "_id" != $2 ORDER BY "tipoUsuario", "primerApellido"`,
        [person.contrato, id]
      )
      relatedPersons = relatedResult.rows
    }

    console.log('🔍 [PostgreSQL] Person By ID: Found person:', person.primerNombre, person.primerApellido)

    return NextResponse.json({
      success: true,
      person,
      financialData,
      relatedPersons
    })

  } catch (error: any) {
    console.error('🔍 [PostgreSQL] Person By ID error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
