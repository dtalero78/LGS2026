import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

/**
 * GET /api/wix-proxy/material-usuario?step=Step 1
 * Obtiene el campo materialUsuario de un step específico desde la colección NIVELES
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const step = searchParams.get('step') || 'Step 1'

    console.log('📚 [PostgreSQL] Obteniendo materialUsuario para step:', step)

    // Query NIVELES table for the material of the specific step
    const result = await query(
      `SELECT "materialUsuario", "material", "code", "step"
       FROM "NIVELES"
       WHERE "step" = $1
       LIMIT 1`,
      [step]
    )

    if (result.rowCount === 0) {
      console.log('⚠️ [PostgreSQL] No material found for step:', step)
      return NextResponse.json({
        success: true,
        materialUsuario: null,
        step: step
      })
    }

    const row = result.rows[0]
    console.log('✅ [PostgreSQL] Material usuario obtenido:', row.materialUsuario ? 'found' : 'empty')

    return NextResponse.json({
      success: true,
      materialUsuario: row.materialUsuario || null,
      material: row.material || null,
      code: row.code,
      step: row.step
    })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error in material-usuario API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
