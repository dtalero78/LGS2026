import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-postgres'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { studentId, setOnHold, fechaOnHold, fechaFinOnHold, motivo } = body

    console.log('📡 [PostgreSQL] toggle-student-onhold recibió:', {
      studentId,
      setOnHold,
      fechaOnHold,
      fechaFinOnHold,
      motivo
    })

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'studentId es requerido' },
        { status: 400 }
      )
    }

    // Get session for user info
    const session = await getServerSession(authOptions)

    // Get current student data
    const studentResult = await query(
      `SELECT "_id", "estadoInactivo", "fechaOnHold", "fechaFinOnHold", "finalContrato",
              "onHoldCount", "onHoldHistory", "extensionCount", "extensionHistory", "vigencia"
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

    // Parse JSONB fields
    let onHoldHistory = Array.isArray(student.onHoldHistory)
      ? student.onHoldHistory
      : JSON.parse(student.onHoldHistory || '[]')

    let extensionHistory = Array.isArray(student.extensionHistory)
      ? student.extensionHistory
      : JSON.parse(student.extensionHistory || '[]')

    if (setOnHold) {
      // ==================== ACTIVATE OnHold ====================
      if (!fechaOnHold || !fechaFinOnHold) {
        return NextResponse.json(
          { success: false, error: 'fechaOnHold y fechaFinOnHold son requeridos para activar OnHold' },
          { status: 400 }
        )
      }

      // Add entry to onHoldHistory
      const newOnHoldEntry = {
        fechaActivacion: new Date().toISOString(),
        fechaOnHold: fechaOnHold,
        fechaFinOnHold: fechaFinOnHold,
        motivo: motivo || 'Sin motivo especificado',
        activadoPor: session?.user?.name || session?.user?.email || 'Unknown'
      }

      onHoldHistory.push(newOnHoldEntry)

      // Update student
      const result = await query(
        `UPDATE "PEOPLE"
         SET "estadoInactivo" = true,
             "fechaOnHold" = $1::timestamp with time zone,
             "fechaFinOnHold" = $2::timestamp with time zone,
             "onHoldCount" = COALESCE("onHoldCount", 0) + 1,
             "onHoldHistory" = $3::jsonb,
             "_updatedDate" = NOW()
         WHERE "_id" = $4
         RETURNING *`,
        [fechaOnHold, fechaFinOnHold, JSON.stringify(onHoldHistory), studentId]
      )

      console.log('✅ [PostgreSQL] OnHold activado:', studentId)

      return NextResponse.json({
        success: true,
        message: 'Estudiante inactivado exitosamente',
        data: result.rows[0],
        onHoldEntry: newOnHoldEntry
      })

    } else {
      // ==================== DEACTIVATE OnHold ====================
      if (!student.fechaOnHold || !student.fechaFinOnHold) {
        return NextResponse.json(
          { success: false, error: 'El estudiante no está actualmente en OnHold' },
          { status: 400 }
        )
      }

      // Calculate days paused
      const fechaOnHoldDate = new Date(student.fechaOnHold)
      const fechaFinOnHoldDate = new Date(student.fechaFinOnHold)
      const daysPaused = Math.ceil((fechaFinOnHoldDate.getTime() - fechaOnHoldDate.getTime()) / (1000 * 60 * 60 * 24))

      // Calculate new finalContrato
      const currentFinalContrato = new Date(student.finalContrato)
      const newFinalContrato = new Date(currentFinalContrato)
      newFinalContrato.setDate(newFinalContrato.getDate() + daysPaused)

      // Add entry to extensionHistory (automatic extension)
      const newExtensionEntry = {
        numero: (student.extensionCount || 0) + 1,
        fechaEjecucion: new Date().toISOString(),
        vigenciaAnterior: currentFinalContrato.toISOString().split('T')[0],
        vigenciaNueva: newFinalContrato.toISOString().split('T')[0],
        diasExtendidos: daysPaused,
        motivo: `Extensión automática por OnHold (${daysPaused} días pausados desde ${fechaOnHoldDate.toISOString().split('T')[0]} hasta ${fechaFinOnHoldDate.toISOString().split('T')[0]})`
      }

      extensionHistory.push(newExtensionEntry)

      // Calculate new vigencia (days remaining)
      const today = new Date()
      const daysRemaining = Math.ceil((newFinalContrato.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Update student
      const result = await query(
        `UPDATE "PEOPLE"
         SET "estadoInactivo" = false,
             "fechaOnHold" = NULL,
             "fechaFinOnHold" = NULL,
             "finalContrato" = $1::timestamp with time zone,
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

      console.log('✅ [PostgreSQL] OnHold desactivado y contrato extendido:', studentId)

      return NextResponse.json({
        success: true,
        message: 'Estudiante activado exitosamente',
        data: result.rows[0],
        extension: {
          daysPaused,
          previousFinalContrato: currentFinalContrato.toISOString().split('T')[0],
          newFinalContrato: newFinalContrato.toISOString().split('T')[0],
          newVigencia: daysRemaining
        }
      })
    }

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error en toggle-student-onhold:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error.message || 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
