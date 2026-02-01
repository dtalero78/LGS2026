import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-postgres'

export async function POST(request: Request) {
  try {
    const { studentId, nuevaFechaFinal, motivo } = await request.json()

    if (!studentId || !nuevaFechaFinal) {
      return NextResponse.json(
        { success: false, error: 'studentId y nuevaFechaFinal son requeridos' },
        { status: 400 }
      )
    }

    console.log('🔄 [PostgreSQL] Extender vigencia de estudiante:', {
      studentId,
      nuevaFechaFinal,
      motivo: motivo || 'Sin motivo especificado'
    })

    // Get session for user info
    const session = await getServerSession(authOptions)

    // Get current student data
    const studentResult = await query(
      `SELECT "_id", "finalContrato", "vigencia", "extensionCount", "extensionHistory"
       FROM "PEOPLE"
       WHERE "_id" = $1`,
      [studentId]
    )

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Estudiante no encontrado' },
        { status: 404 }
      )
    }

    const student = studentResult.rows[0]

    // Parse extensionHistory
    let extensionHistory = Array.isArray(student.extensionHistory)
      ? student.extensionHistory
      : JSON.parse(student.extensionHistory || '[]')

    // Calculate days extended
    const currentFinalContrato = new Date(student.finalContrato)
    const newFinalContrato = new Date(nuevaFechaFinal)
    const daysExtended = Math.ceil((newFinalContrato.getTime() - currentFinalContrato.getTime()) / (1000 * 60 * 60 * 24))

    // Create extension history entry
    const newExtensionEntry = {
      numero: (student.extensionCount || 0) + 1,
      fechaEjecucion: new Date().toISOString(),
      vigenciaAnterior: currentFinalContrato.toISOString().split('T')[0],
      vigenciaNueva: newFinalContrato.toISOString().split('T')[0],
      diasExtendidos: daysExtended,
      motivo: motivo || 'Extensión manual',
      ejecutadoPor: session?.user?.name || session?.user?.email || 'Unknown'
    }

    extensionHistory.push(newExtensionEntry)

    // Calculate new vigencia (days remaining from today)
    const today = new Date()
    const daysRemaining = Math.ceil((newFinalContrato.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Update student
    const result = await query(
      `UPDATE "PEOPLE"
       SET "finalContrato" = $1::timestamp with time zone,
           "vigencia" = $2,
           "extensionCount" = COALESCE("extensionCount", 0) + 1,
           "extensionHistory" = $3::jsonb,
           "_updatedDate" = NOW()
       WHERE "_id" = $4
       RETURNING *`,
      [
        newFinalContrato.toISOString(),
        daysRemaining.toString(),
        JSON.stringify(extensionHistory),
        studentId
      ]
    )

    console.log('✅ [PostgreSQL] Vigencia extendida exitosamente:', {
      studentId,
      nuevaFechaFinal,
      extensionNumero: newExtensionEntry.numero
    })

    return NextResponse.json({
      success: true,
      data: {
        student: result.rows[0],
        extension: newExtensionEntry,
        extensionNumero: newExtensionEntry.numero
      }
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error al extender vigencia:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
