import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: Request) {
  try {
    const { contrato, titularId, beneficiaryIds, setOnHold, fechaOnHold, fechaFinOnHold } = await request.json()

    if (!contrato || !titularId || setOnHold === undefined) {
      return NextResponse.json(
        { success: false, error: 'contrato, titularId y setOnHold son requeridos' },
        { status: 400 }
      )
    }

    if (setOnHold && (!fechaOnHold || !fechaFinOnHold)) {
      return NextResponse.json(
        { success: false, error: 'fechaOnHold y fechaFinOnHold son requeridos para activar OnHold' },
        { status: 400 }
      )
    }

    console.log('🔄 [PostgreSQL] Toggle OnHold status', {
      contrato,
      titularId,
      beneficiaryCount: beneficiaryIds?.length || 0,
      setOnHold,
      fechaOnHold,
      fechaFinOnHold
    })

    // Get all people to update (titular + beneficiaries)
    const allIds = [titularId, ...(beneficiaryIds || [])]
    const updatedPeople = []

    for (const personId of allIds) {
      // Get current person data
      const personResult = await query(
        `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
        [personId]
      )

      if (personResult.rowCount === 0) {
        console.log(`⚠️ Person not found: ${personId}`)
        continue
      }

      const person = personResult.rows[0]

      if (setOnHold) {
        // Activating OnHold
        const onHoldHistory = person.onHoldHistory || []
        const newEntry = {
          fechaActivacion: new Date().toISOString(),
          fechaOnHold,
          fechaFinOnHold,
          motivo: 'OnHold de contrato',
          activadoPor: 'Admin'
        }
        onHoldHistory.push(newEntry)

        await query(
          `UPDATE "PEOPLE"
           SET "estadoInactivo" = true,
               "fechaOnHold" = $1,
               "fechaFinOnHold" = $2,
               "onHoldCount" = COALESCE("onHoldCount", 0) + 1,
               "onHoldHistory" = $3,
               "_updatedDate" = NOW()
           WHERE "_id" = $4`,
          [fechaOnHold, fechaFinOnHold, JSON.stringify(onHoldHistory), personId]
        )

        // Update ACADEMICA if exists
        await query(
          `UPDATE "ACADEMICA"
           SET "estadoInactivo" = true,
               "_updatedDate" = NOW()
           WHERE "visitorId" = $1`,
          [personId]
        )

      } else {
        // Deactivating OnHold - calculate extension
        const currentFechaOnHold = person.fechaOnHold
        const currentFechaFinOnHold = person.fechaFinOnHold

        if (currentFechaOnHold && currentFechaFinOnHold && person.finalContrato) {
          const fechaOnHoldDate = new Date(currentFechaOnHold)
          const fechaFinOnHoldDate = new Date(currentFechaFinOnHold)
          const daysPaused = Math.ceil((fechaFinOnHoldDate.getTime() - fechaOnHoldDate.getTime()) / (1000 * 60 * 60 * 24))

          const currentFinalContrato = new Date(person.finalContrato)
          const newFinalContrato = new Date(currentFinalContrato)
          newFinalContrato.setDate(newFinalContrato.getDate() + daysPaused)

          // Create extension history entry
          const extensionHistory = person.extensionHistory || []
          const newExtension = {
            numero: (person.extensionCount || 0) + 1,
            fechaEjecucion: new Date().toISOString(),
            vigenciaAnterior: currentFinalContrato.toISOString().split('T')[0],
            vigenciaNueva: newFinalContrato.toISOString().split('T')[0],
            diasExtendidos: daysPaused,
            motivo: `Extensión automática por OnHold (${daysPaused} días pausados desde ${currentFechaOnHold} hasta ${currentFechaFinOnHold})`
          }
          extensionHistory.push(newExtension)

          // Calculate new vigencia
          const today = new Date()
          const newVigencia = Math.ceil((newFinalContrato.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          await query(
            `UPDATE "PEOPLE"
             SET "estadoInactivo" = false,
                 "fechaOnHold" = NULL,
                 "fechaFinOnHold" = NULL,
                 "finalContrato" = $1,
                 "vigencia" = $2,
                 "extensionCount" = COALESCE("extensionCount", 0) + 1,
                 "extensionHistory" = $3,
                 "_updatedDate" = NOW()
             WHERE "_id" = $4`,
            [newFinalContrato.toISOString().split('T')[0], newVigencia, JSON.stringify(extensionHistory), personId]
          )
        } else {
          // Just deactivate without extension
          await query(
            `UPDATE "PEOPLE"
             SET "estadoInactivo" = false,
                 "fechaOnHold" = NULL,
                 "fechaFinOnHold" = NULL,
                 "_updatedDate" = NOW()
             WHERE "_id" = $1`,
            [personId]
          )
        }

        // Update ACADEMICA
        await query(
          `UPDATE "ACADEMICA"
           SET "estadoInactivo" = false,
               "_updatedDate" = NOW()
           WHERE "visitorId" = $1`,
          [personId]
        )
      }

      updatedPeople.push(personId)
    }

    console.log('✅ [PostgreSQL] OnHold actualizado exitosamente:', {
      contrato,
      onHoldStatus: setOnHold,
      updatedCount: updatedPeople.length
    })

    return NextResponse.json({
      success: true,
      data: {
        contrato,
        setOnHold,
        updatedPeople
      }
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error al cambiar estado OnHold:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
