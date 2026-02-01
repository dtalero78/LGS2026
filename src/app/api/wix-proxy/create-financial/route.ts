import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('💰 [PostgreSQL] Creating financial record:', body)

    const {
      titularId,
      contrato,
      primerNombre,
      primerApellido,
      numeroId,
      totalPlan,
      valorCuota,
      pagoInscripcion,
      saldo,
      numeroCuotas,
      fechaPago,
      vigencia,
      medioPago
    } = body

    // Generate unique ID
    const financialId = `fin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const result = await query(
      `INSERT INTO "FINANCIEROS" (
        "_id", "titularId", "contrato", "primerNombre", "primerApellido",
        "numeroId", "totalPlan", "valorCuota", "pagoInscripcion", "saldo",
        "numeroCuotas", "fechaPago", "vigencia", "medioPago",
        "origen", "_createdDate", "_updatedDate"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'POSTGRES', NOW(), NOW())
      RETURNING *`,
      [
        financialId,
        titularId || null,
        contrato || null,
        primerNombre || null,
        primerApellido || null,
        numeroId || null,
        totalPlan || null,
        valorCuota || null,
        pagoInscripcion || null,
        saldo || null,
        numeroCuotas || 0,
        fechaPago || null,
        vigencia || null,
        medioPago || null
      ]
    )

    console.log('✅ [PostgreSQL] Financial record created:', financialId)

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error creating financial record:', error)
    return NextResponse.json(
      { error: error.message || 'Error creating financial record' },
      { status: 500 }
    )
  }
}
