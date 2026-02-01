import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { beneficiaryId, beneficiarioId } = body

    const id = beneficiaryId || beneficiarioId
    console.log('🔄 [PostgreSQL] Inactivating beneficiary:', id)

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'beneficiaryId is required' },
        { status: 400 }
      )
    }

    // Update PEOPLE table - set estadoInactivo to true
    const result = await query(
      `UPDATE "PEOPLE"
       SET "estadoInactivo" = true, "_updatedDate" = NOW()
       WHERE "_id" = $1
       RETURNING *`,
      [id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Beneficiary not found' },
        { status: 404 }
      )
    }

    // Also update ACADEMICA if exists
    await query(
      `UPDATE "ACADEMICA"
       SET "estadoInactivo" = true, "_updatedDate" = NOW()
       WHERE "_id" = $1 OR "numeroId" = (
         SELECT "numeroId" FROM "PEOPLE" WHERE "_id" = $1
       )`,
      [id]
    )

    console.log('✅ [PostgreSQL] Beneficiary inactivated successfully')

    return NextResponse.json({
      success: true,
      message: 'Beneficiary inactivated successfully',
      person: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ Error in inactivateBeneficiario:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to inactivate beneficiary', details: error.message },
      { status: 500 }
    )
  }
}
