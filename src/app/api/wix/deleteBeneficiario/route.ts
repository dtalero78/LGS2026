import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { beneficiaryId, beneficiarioId } = body

    const id = beneficiaryId || beneficiarioId
    console.log('🗑️ [PostgreSQL] Deleting beneficiary:', id)

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'beneficiaryId is required' },
        { status: 400 }
      )
    }

    // Get numeroId before deleting to also remove from ACADEMICA
    const personResult = await query(
      `SELECT "numeroId" FROM "PEOPLE" WHERE "_id" = $1`,
      [id]
    )

    const numeroId = personResult.rows[0]?.numeroId

    // Delete from ACADEMICA_BOOKINGS first (foreign key constraint)
    if (numeroId) {
      await query(
        `DELETE FROM "ACADEMICA_BOOKINGS" WHERE "visitorId" IN (
          SELECT "_id" FROM "ACADEMICA" WHERE "numeroId" = $1
        )`,
        [numeroId]
      )

      // Delete from ACADEMICA
      await query(
        `DELETE FROM "ACADEMICA" WHERE "numeroId" = $1`,
        [numeroId]
      )
    }

    // Delete from PEOPLE
    const result = await query(
      `DELETE FROM "PEOPLE" WHERE "_id" = $1 RETURNING *`,
      [id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Beneficiary not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Beneficiary deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Beneficiary deleted successfully'
    })

  } catch (error: any) {
    console.error('❌ Error in deleteBeneficiario:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete beneficiary', details: error.message },
      { status: 500 }
    )
  }
}
