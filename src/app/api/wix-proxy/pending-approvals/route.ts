import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    console.log('📥 [PostgreSQL] Obteniendo registros pendientes de aprobación')

    // Query PEOPLE table for pending approvals
    // Pendiente = records with estado = 'Pendiente' and tipoUsuario = 'TITULAR'
    const result = await query(`
      SELECT
        p."_id",
        p."primerNombre",
        p."segundoNombre",
        p."primerApellido",
        p."segundoApellido",
        p."numeroId",
        p."email",
        p."celular",
        p."contrato",
        p."tipoUsuario",
        p."estado",
        p."pais",
        p."ciudad",
        p."finalContrato",
        p."vigencia",
        p."_createdDate",
        p."_updatedDate",
        (
          SELECT COUNT(*)
          FROM "PEOPLE" b
          WHERE b."contrato" = p."contrato"
          AND b."tipoUsuario" = 'BENEFICIARIO'
        ) as "beneficiariosCount"
      FROM "PEOPLE" p
      WHERE p."estado" = 'Pendiente'
        AND p."tipoUsuario" = 'TITULAR'
      ORDER BY p."_createdDate" DESC
    `)

    console.log('✅ [PostgreSQL] Registros pendientes obtenidos:', result.rowCount)

    return NextResponse.json({
      success: true,
      items: result.rows,
      totalRecords: result.rowCount
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error en pending-approvals:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
