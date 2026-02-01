import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = searchParams.get('nivel')
    const studentId = searchParams.get('studentId')

    if (!nivel || !studentId) {
      return NextResponse.json(
        { success: false, error: 'nivel and studentId parameters are required' },
        { status: 400 }
      )
    }

    console.log('📊 [PostgreSQL] Loading level steps:', { nivel, studentId })

    // Get all steps for this level from NIVELES table
    const stepsResult = await query(
      `SELECT "code", "step", "esParalelo", "clubs", "material"
       FROM "NIVELES"
       WHERE "code" = $1
       ORDER BY "step"`,
      [nivel]
    )

    // Get student's current progress
    const studentResult = await query(
      `SELECT "nivel", "step", "nivelParalelo", "stepParalelo"
       FROM "PEOPLE"
       WHERE "_id" = $1 OR "numeroId" = $1`,
      [studentId]
    )

    // Get completed steps from ACADEMICA_BOOKINGS
    const completedResult = await query(
      `SELECT DISTINCT ab."nivel", ab."step"
       FROM "ACADEMICA_BOOKINGS" ab
       WHERE ab."visitorId" = $1
         AND ab."asistio" = true
         AND ab."nivel" = $2`,
      [studentId, nivel]
    )

    const student = studentResult.rows[0] || {}
    const completedSteps = completedResult.rows.map(r => r.step)
    const steps = stepsResult.rows

    // Build response
    const stepsData = steps.map(s => ({
      step: s.step,
      nivel: s.code,
      esParalelo: s.esParalelo || false,
      clubs: s.clubs || [],
      material: s.material || [],
      completed: completedSteps.includes(s.step),
      isCurrent: student.step === s.step || student.stepParalelo === s.step
    }))

    console.log('✅ [PostgreSQL] Level steps loaded:', stepsData.length)

    return NextResponse.json({
      success: true,
      steps: stepsData,
      nivel: nivel,
      esParalelo: steps[0]?.esParalelo || false,
      totalSteps: stepsData.length,
      completedCount: completedSteps.length
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in level-steps API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
