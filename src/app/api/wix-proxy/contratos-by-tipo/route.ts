import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipoUsuario = searchParams.get('tipoUsuario') || 'TITULAR'

    console.log('📋 [PostgreSQL] Contratos By Tipo:', tipoUsuario)

    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM "PEOPLE" b
         WHERE b."contrato" = p."contrato" AND b."tipoUsuario" = 'BENEFICIARIO'
        ) as "beneficiariosCount"
       FROM "PEOPLE" p
       WHERE p."tipoUsuario" = $1
       ORDER BY p."_createdDate" DESC`,
      [tipoUsuario]
    )

    // Get ACADEMICA data for these people
    const personIds = result.rows.map((p: any) => p._id)
    let academicaData: any[] = []

    if (personIds.length > 0) {
      const academicaResult = await query(
        `SELECT * FROM "ACADEMICA"
         WHERE "visitorId" = ANY($1)`,
        [personIds]
      )
      academicaData = academicaResult.rows
    }

    console.log('📋 [PostgreSQL] Found', result.rowCount, 'people of type', tipoUsuario)

    return NextResponse.json({
      success: true,
      data: {
        people: result.rows,
        academica: academicaData
      },
      totalCount: result.rowCount || 0
    })

  } catch (error: any) {
    console.error('📋 [PostgreSQL] Contratos By Tipo error:', error)
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: error.message || 'Internal server error'
    })
  }
}
