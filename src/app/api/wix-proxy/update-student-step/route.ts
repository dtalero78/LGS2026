import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const stepData = await request.json()
    console.log('🎯 [PostgreSQL] Updating student step:', stepData)

    const { numeroId, newStep } = stepData

    if (!numeroId || newStep === undefined) {
      return NextResponse.json(
        { success: false, error: 'numeroId and newStep are required' },
        { status: 400 }
      )
    }

    // Get student
    const studentResult = await query(
      `SELECT "_id", "numeroId", "nivel", "step", "nivelParalelo", "stepParalelo"
       FROM "PEOPLE" WHERE "numeroId" = $1`,
      [numeroId]
    )

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      )
    }

    const student = studentResult.rows[0]

    // Find the nivel and step from NIVELES table
    const nivelResult = await query(
      `SELECT "code", "step", "esParalelo"
       FROM "NIVELES"
       WHERE "step" = $1
       LIMIT 1`,
      [`Step ${newStep}`]
    )

    if (nivelResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: `Step "${newStep}" not found in NIVELES table` },
        { status: 404 }
      )
    }

    const nivelData = nivelResult.rows[0]
    const isParallel = nivelData.esParalelo === true
    const newNivel = nivelData.code
    const newStepName = nivelData.step

    // Prepare update based on whether it's a parallel nivel
    let updateFields: { [key: string]: any } = {}

    if (isParallel) {
      // Update parallel level fields
      updateFields = {
        nivelParalelo: newNivel,
        stepParalelo: newStepName,
      }
    } else {
      // Update main level fields
      updateFields = {
        nivel: newNivel,
        step: newStepName,
      }
    }

    // Update PEOPLE table
    const peopleUpdateQuery = `
      UPDATE "PEOPLE"
      SET ${Object.keys(updateFields)
        .map((key, index) => `"${key}" = $${index + 2}`)
        .join(', ')},
          "_updatedDate" = NOW()
      WHERE "_id" = $1
      RETURNING *
    `
    const peopleValues = [student._id, ...Object.values(updateFields)]
    const peopleUpdateResult = await query(peopleUpdateQuery, peopleValues)

    // Update ACADEMICA table (if student has academic records)
    const academicaUpdateQuery = `
      UPDATE "ACADEMICA"
      SET ${Object.keys(updateFields)
        .map((key, index) => `"${key}" = $${index + 2}`)
        .join(', ')},
          "_updatedDate" = NOW()
      WHERE "numeroId" = $1
    `
    const academicaValues = [student.numeroId, ...Object.values(updateFields)]
    await query(academicaUpdateQuery, academicaValues)

    console.log('✅ [PostgreSQL] Student step updated:', student.numeroId, '→', newNivel, newStepName)

    return NextResponse.json({
      success: true,
      message: `Step actualizado exitosamente a ${newNivel} - ${newStepName}`,
      student: peopleUpdateResult.rows[0],
      isParallel,
      updatedFields: updateFields,
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in update-student-step API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
