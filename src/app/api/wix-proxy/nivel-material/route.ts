import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

/**
 * GET /api/wix-proxy/nivel-material?step=Step1
 * Obtiene los materiales de un step específico desde la colección NIVELES
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const step = searchParams.get('step')

    if (!step) {
      return NextResponse.json(
        { success: false, error: 'Step parameter is required' },
        { status: 400 }
      )
    }

    console.log('📚 [PostgreSQL] Obteniendo material para step:', step)

    // Query NIVELES table for the material of the specific step
    const result = await query(
      `SELECT "material", "materialUsuario", "code", "step", "clubs", "description"
       FROM "NIVELES"
       WHERE "step" = $1
       LIMIT 1`,
      [step]
    )

    if (result.rowCount === 0) {
      console.log('⚠️ [PostgreSQL] No material found for step:', step)
      return NextResponse.json({
        success: true,
        material: null,
        step: step
      })
    }

    const row = result.rows[0]
    console.log('✅ [PostgreSQL] Material obtenido para step:', step)

    return NextResponse.json({
      success: true,
      material: row.material || null,
      materialUsuario: row.materialUsuario || null,
      code: row.code,
      step: row.step,
      clubs: row.clubs || [],
      description: row.description || ''
    })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error in nivel-material API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
