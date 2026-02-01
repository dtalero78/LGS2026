import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    console.log('📚 [PostgreSQL] Fetching niveles directly')

    const result = await query(`SELECT * FROM "NIVELES" ORDER BY "code" ASC`)

    if (result.rowCount === 0) {
      console.log('⚠️ [PostgreSQL] No niveles found')
      return NextResponse.json({
        success: true,
        niveles: [],
        source: 'postgres'
      })
    }

    // Transform PostgreSQL response to match expected format
    // PostgreSQL returns individual step records, need to group by level code
    const stepsGroupedByLevel: Record<string, any[]> = {}

    result.rows.forEach((step: any) => {
      if (!stepsGroupedByLevel[step.code]) {
        stepsGroupedByLevel[step.code] = []
      }
      stepsGroupedByLevel[step.code].push(step)
    })

    // Build niveles array in expected format
    const niveles = Object.keys(stepsGroupedByLevel).map(code => {
      const steps = stepsGroupedByLevel[code]
      const firstStep = steps[0]

      // Sort steps by step number (extract number from "Step 1", "Step 2", etc.)
      const sortedSteps = steps
        .filter(s => s.step) // Remove nulls
        .sort((a, b) => {
          const aNum = parseInt(a.step.replace(/\D/g, '')) || 0
          const bNum = parseInt(b.step.replace(/\D/g, '')) || 0
          return aNum - bNum
        })

      return {
        _id: firstStep._id,
        code: code,
        steps: sortedSteps.map(s => s.step), // Array of step names: ['Step 1', 'Step 2', ...]
        clubs: firstStep.clubs || [],
        material: firstStep.material || [],
        esParalelo: firstStep.esParalelo || false,
        description: firstStep.description || ''
      }
    })

    console.log('✅ [PostgreSQL] Niveles received:', niveles.length, 'levels')

    return NextResponse.json({
      success: true,
      niveles: niveles,
      source: 'postgres'
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in niveles API:', error)

    // Fallback con datos estructurados básicos en caso de error
    const fallbackNiveles = [
      {
        _id: 'bn1',
        code: 'BN1',
        steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'],
        clubs: ['PRONUNCIATION - Step 1', 'GRAMMAR - Step 1', 'LISTENING - Step 1']
      },
      {
        _id: 'bn2',
        code: 'BN2',
        steps: ['Step 6', 'Step 7', 'Step 8', 'Step 9', 'Step 10'],
        clubs: ['PRONUNCIATION - Step 6', 'GRAMMAR - Step 6', 'LISTENING - Step 6']
      },
      {
        _id: 'p1',
        code: 'P1',
        steps: ['Step 16', 'Step 17', 'Step 18', 'Step 19', 'Step 20'],
        clubs: ['PRONUNCIATION - Step 16', 'GRAMMAR - Step 16', 'CONVERSATION - Step 16']
      }
    ]

    return NextResponse.json({
      success: true,
      niveles: fallbackNiveles,
      source: 'fallback_data'
    })
  }
}
