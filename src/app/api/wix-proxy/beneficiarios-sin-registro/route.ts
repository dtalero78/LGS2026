import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [PostgreSQL] Fetching beneficiarios sin registro ACADEMICA...')

    // Find beneficiaries who don't have an ACADEMICA record
    const result = await query(`
      SELECT p.*
      FROM "PEOPLE" p
      WHERE p."tipoUsuario" = 'BENEFICIARIO'
        AND p."estado" = 'Aprobado'
        AND p."estadoInactivo" IS NOT TRUE
        AND NOT EXISTS (
          SELECT 1 FROM "ACADEMICA" a WHERE a."visitorId" = p."_id"
        )
      ORDER BY p."_createdDate" DESC
    `)

    // Also get ACADEMICA records without proper PEOPLE link for stats
    const academicaOrphanResult = await query(`
      SELECT a.*
      FROM "ACADEMICA" a
      WHERE NOT EXISTS (
        SELECT 1 FROM "PEOPLE" p WHERE p."_id" = a."visitorId"
      )
    `)

    console.log('✅ [PostgreSQL] Beneficiarios sin registro:', result.rowCount)

    return NextResponse.json({
      success: true,
      data: {
        people: result.rows,
        academica: academicaOrphanResult.rows
      },
      totalCount: result.rowCount || 0,
      stats: {
        beneficiariosSinRegistro: result.rowCount || 0,
        academicasSinPeople: academicaOrphanResult.rowCount || 0
      }
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Beneficiarios Sin Registro error:', error)
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: error.message || 'Internal server error'
    })
  }
}
