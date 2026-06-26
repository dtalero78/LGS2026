import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { recordCronRun } from '@/lib/cron-runs'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron Job: Reactivar estudiantes con OnHold vencido
 *
 * Llamado por cron-worker (Node.js daemon en Digital Ocean) a las 03:00 UTC
 * todos los días con Authorization: Bearer <CRON_SECRET>.
 *
 * Cada ejecución queda registrada en CRON_RUNS via recordCronRun() — el
 * endpoint /api/cron/health-check expone la última ejecución para detectar
 * si el cron lleva mucho sin correr.
 *
 * Por cada estudiante con OnHold vencido:
 *   - Extiende finalContrato por los días pausados
 *   - Marca estadoInactivo=false y limpia fechaOnHold
 *   - Incrementa extensionCount y agrega entrada a extensionHistory
 *   - Sincroniza ACADEMICA.estadoInactivo=false (por numeroId)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    console.log('Cron reactivate-onhold: Unauthorized request')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await recordCronRun('reactivate-onhold', async () => {
      console.log('Cron reactivate-onhold: [PostgreSQL] Iniciando proceso de reactivación automática')

      const expiredResult = await query(
        `SELECT * FROM "PEOPLE"
         WHERE "estadoInactivo" = true
           AND "fechaFinOnHold" IS NOT NULL
           AND "fechaFinOnHold"::date <= CURRENT_DATE
         ORDER BY "fechaFinOnHold" ASC`
      )

      const students = expiredResult.rows
      if (students.length === 0) {
        console.log('Cron reactivate-onhold: No hay estudiantes con OnHold vencido')
        return {
          processedCount: 0,
          successCount: 0,
          failedCount: 0,
          metadata: { details: [] },
        }
      }

      console.log(`Cron reactivate-onhold: Encontrados ${students.length} estudiantes con OnHold vencido`)

      const details: Array<{
        studentId: string
        nombre: string
        success: boolean
        error?: string
        diasExtendidos?: number
      }> = []

      for (const student of students) {
        try {
          console.log(`Cron reactivate-onhold: Reactivando estudiante ${student._id} - ${student.primerNombre} ${student.primerApellido}`)

          const fechaOnHold = new Date(student.fechaOnHold)
          const fechaFinOnHold = new Date(student.fechaFinOnHold)
          const diasPausados = Math.ceil((fechaFinOnHold.getTime() - fechaOnHold.getTime()) / (1000 * 60 * 60 * 24))

          let newFinalContrato = student.finalContrato
          let newVigencia = student.vigencia ?? null
          if (student.finalContrato) {
            const finalDate = new Date(student.finalContrato)
            finalDate.setDate(finalDate.getDate() + diasPausados)
            newFinalContrato = finalDate.toISOString().split('T')[0]
            newVigencia = Math.ceil((finalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          }

          // Reactivación idéntica al panel/manual: limpia OnHold, extiende
          // finalContrato por los días pausados y RESTAURA estado='ACTIVA'.
          // NO toca extensionCount/extensionHistory (la traza vive en
          // onHoldHistory) — consistente con contractService.deactivateOnHold
          // y panel-estudiante.service.resolveStudentFromSession.
          await query(
            `UPDATE "PEOPLE" SET
              "estadoInactivo" = false,
              "estado" = 'ACTIVA',
              "fechaOnHold" = NULL,
              "fechaFinOnHold" = NULL,
              "finalContrato" = $2,
              "vigencia" = $3,
              "_updatedDate" = NOW()
            WHERE "_id" = $1`,
            [student._id, newFinalContrato, newVigencia]
          )

          // Sync ACADEMICA.estadoInactivo (por numeroId).
          if (student.numeroId) {
            await query(
              `UPDATE "ACADEMICA" SET "estadoInactivo" = false, "_updatedDate" = NOW() WHERE "numeroId" = $1`,
              [student.numeroId]
            ).catch(err => console.warn(`Cron reactivate-onhold: ACADEMICA sync failed for ${student.numeroId}:`, err))
          }

          // Sync USUARIOS_ROLES.activo=true (RESTAURAR login). Sin esto el
          // estudiante quedaba reactivado (estadoInactivo=false) pero con el
          // login bloqueado → no podía entrar. Bug histórico: el cron no
          // restauraba el acceso (el panel/manual sí lo hacen).
          if (student.email) {
            await query(
              `UPDATE "USUARIOS_ROLES" SET "activo" = true, "_updatedDate" = NOW() WHERE LOWER("email") = LOWER($1)`,
              [student.email]
            ).catch(err => console.warn(`Cron reactivate-onhold: USUARIOS_ROLES sync failed for ${student.email}:`, err))
          }

          console.log(`Cron reactivate-onhold: Estudiante ${student._id} reactivado exitosamente`)
          details.push({
            studentId: student._id,
            nombre: `${student.primerNombre} ${student.primerApellido}`,
            success: true,
            diasExtendidos: diasPausados
          })
        } catch (studentError) {
          console.error(`Cron reactivate-onhold: Error procesando estudiante ${student._id}:`, studentError)
          details.push({
            studentId: student._id,
            nombre: `${student.primerNombre} ${student.primerApellido}`,
            success: false,
            error: studentError instanceof Error ? studentError.message : 'Error desconocido'
          })
        }
      }

      const successful = details.filter(r => r.success).length
      const failed = details.filter(r => !r.success).length
      console.log(`Cron reactivate-onhold: Proceso completado. Exitosos: ${successful}, Fallidos: ${failed}`)

      return {
        processedCount: students.length,
        successCount: successful,
        failedCount: failed,
        metadata: { details },
      }
    })

    return NextResponse.json({
      success: true,
      message: result.processedCount === 0
        ? 'No hay estudiantes con OnHold vencido para reactivar'
        : `Proceso completado. ${result.successCount} estudiantes reactivados, ${result.failedCount} fallidos.`,
      processed: result.processedCount,
      successful: result.successCount,
      failed: result.failedCount,
      results: result.metadata?.details ?? [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cron reactivate-onhold: Error general:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
