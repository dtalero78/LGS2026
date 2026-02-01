import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pattern, year } = body

    console.log('🔍 [PostgreSQL] Fetching contracts by pattern:', { pattern, year })

    // Build the search pattern for LIKE query
    let searchPattern = pattern ? `${pattern}%` : '%'
    if (year) {
      searchPattern = `${pattern || ''}-%-${year}`
    }

    const result = await query(
      `SELECT DISTINCT "contrato", "primerNombre", "primerApellido", "numeroId"
       FROM "PEOPLE"
       WHERE "contrato" LIKE $1 AND "tipoUsuario" = 'TITULAR'
       ORDER BY "contrato" DESC
       LIMIT 100`,
      [searchPattern]
    )

    console.log('✅ [PostgreSQL] Found', result.rowCount, 'contracts')

    return NextResponse.json({
      success: true,
      contracts: result.rows
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error fetching contracts:', error)
    return NextResponse.json(
      { error: error.message || 'Error fetching contracts' },
      { status: 500 }
    )
  }
}
