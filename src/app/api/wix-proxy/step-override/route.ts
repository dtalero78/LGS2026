import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const overrideData = await request.json()
    const { studentId, step, nivel, completed, completedBy } = overrideData

    console.log('➕ [PostgreSQL] Creating/updating step override:', overrideData)

    if (!studentId || !step) {
      return NextResponse.json(
        { success: false, error: 'studentId y step son requeridos' },
        { status: 400 }
      )
    }

    // Check if override already exists
    const existing = await query(
      `SELECT "_id" FROM "STEP_OVERRIDES" WHERE "studentId" = $1 AND "step" = $2`,
      [studentId, step]
    )

    let result
    if (existing.rowCount && existing.rowCount > 0) {
      // Update existing override
      result = await query(
        `UPDATE "STEP_OVERRIDES"
         SET "completed" = $1,
             "completedBy" = $2,
             "nivel" = $3,
             "_updatedDate" = NOW()
         WHERE "studentId" = $4 AND "step" = $5
         RETURNING *`,
        [completed !== false, completedBy || null, nivel || null, studentId, step]
      )
      console.log('✅ [PostgreSQL] Step override updated')
    } else {
      // Create new override
      const overrideId = `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      result = await query(
        `INSERT INTO "STEP_OVERRIDES" (
          "_id", "studentId", "step", "nivel", "completed", "completedBy",
          "origen", "_createdDate", "_updatedDate"
        ) VALUES ($1, $2, $3, $4, $5, $6, 'POSTGRES', NOW(), NOW())
        RETURNING *`,
        [overrideId, studentId, step, nivel || null, completed !== false, completedBy || null]
      )
      console.log('✅ [PostgreSQL] Step override created')
    }

    return NextResponse.json({
      success: true,
      override: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in step-override API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const step = searchParams.get('step')

    if (!studentId || !step) {
      return NextResponse.json(
        { success: false, error: 'studentId and step parameters are required' },
        { status: 400 }
      )
    }

    console.log('🗑️ [PostgreSQL] Deleting step override:', { studentId, step })

    const result = await query(
      `DELETE FROM "STEP_OVERRIDES" WHERE "studentId" = $1 AND "step" = $2 RETURNING *`,
      [studentId, step]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Override no encontrado' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Step override deleted')

    return NextResponse.json({
      success: true,
      deleted: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in delete step-override API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
