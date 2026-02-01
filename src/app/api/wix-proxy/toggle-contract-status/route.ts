import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: Request) {
  try {
    const { contrato, titularId, beneficiaryIds, setInactive } = await request.json()

    if (!contrato || !titularId || setInactive === undefined) {
      return NextResponse.json(
        { success: false, error: 'contrato, titularId y setInactive son requeridos' },
        { status: 400 }
      )
    }

    console.log('🔄 [PostgreSQL] Toggle contract status', {
      contrato,
      titularId,
      beneficiaryCount: beneficiaryIds?.length || 0,
      setInactive
    })

    const newEstado = setInactive ? 'Inactivo' : 'Aprobado'
    let updatedCount = 0

    // Update titular
    const titularResult = await query(
      `UPDATE "PEOPLE"
       SET "estado" = $1,
           "estadoInactivo" = $2,
           "_updatedDate" = NOW()
       WHERE "_id" = $3
       RETURNING "_id"`,
      [newEstado, setInactive, titularId]
    )
    updatedCount += titularResult.rowCount || 0

    // Update all beneficiaries for this contract
    const beneficiariesResult = await query(
      `UPDATE "PEOPLE"
       SET "estado" = $1,
           "estadoInactivo" = $2,
           "_updatedDate" = NOW()
       WHERE "contrato" = $3
         AND "tipoUsuario" = 'BENEFICIARIO'
       RETURNING "_id"`,
      [newEstado, setInactive, contrato]
    )
    updatedCount += beneficiariesResult.rowCount || 0

    // Also update ACADEMICA records for the contract
    await query(
      `UPDATE "ACADEMICA"
       SET "estadoInactivo" = $1,
           "_updatedDate" = NOW()
       WHERE "contrato" = $2`,
      [setInactive, contrato]
    )

    console.log('✅ [PostgreSQL] Contrato actualizado exitosamente:', {
      contrato,
      updatedCount,
      newEstado
    })

    return NextResponse.json({
      success: true,
      updatedCount,
      data: {
        contrato,
        newEstado,
        titularUpdated: titularResult.rowCount || 0,
        beneficiariesUpdated: beneficiariesResult.rowCount || 0
      }
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error al cambiar estado del contrato:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
