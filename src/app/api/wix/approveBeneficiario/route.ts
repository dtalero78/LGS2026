import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { visitorId, beneficiaryId } = body

    console.log('✅ [PostgreSQL] Approving beneficiary:', beneficiaryId || visitorId)

    const id = beneficiaryId || visitorId
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'beneficiaryId or visitorId is required' },
        { status: 400 }
      )
    }

    // Update PEOPLE table - set aprobacion to 'Aprobado'
    const result = await query(
      `UPDATE "PEOPLE"
       SET "aprobacion" = 'Aprobado', "_updatedDate" = NOW()
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

    console.log('✅ [PostgreSQL] Beneficiary approved successfully')

    return NextResponse.json({
      success: true,
      message: 'Beneficiary approved successfully',
      person: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ Error in approveBeneficiario:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to approve beneficiary', details: error.message },
      { status: 500 }
    )
  }
}
