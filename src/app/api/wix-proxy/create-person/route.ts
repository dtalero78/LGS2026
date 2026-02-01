import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('👤 [PostgreSQL] Creating person:', body)

    // Generate new ID
    const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Extract fields from body
    const {
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      numeroId,
      email,
      celular,
      tipoUsuario,
      contrato,
      pais,
      ciudad,
      domicilio,
      fechaNacimiento,
      estado,
      nivel,
      step,
      finalContrato,
      vigencia
    } = body

    // Validate required fields
    if (!primerNombre || !primerApellido || !numeroId) {
      return NextResponse.json(
        { success: false, error: 'primerNombre, primerApellido y numeroId son requeridos' },
        { status: 400 }
      )
    }

    // Insert person into PEOPLE table
    const result = await query(
      `INSERT INTO "PEOPLE" (
        "_id", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "numeroId", "email", "celular", "tipoUsuario", "contrato", "pais", "ciudad",
        "domicilio", "fechaNacimiento", "estado", "nivel", "step", "finalContrato",
        "vigencia", "origen", "_createdDate", "_updatedDate"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        'POSTGRES', NOW(), NOW()
      )
      RETURNING *`,
      [
        personId,
        primerNombre,
        segundoNombre || null,
        primerApellido,
        segundoApellido || null,
        numeroId,
        email || null,
        celular || null,
        tipoUsuario || 'BENEFICIARIO',
        contrato || null,
        pais || null,
        ciudad || null,
        domicilio || null,
        fechaNacimiento || null,
        estado || 'Pendiente',
        nivel || null,
        step || null,
        finalContrato || null,
        vigencia || null
      ]
    )

    console.log('✅ [PostgreSQL] Person created:', personId)

    // If it's a beneficiary with a nivel, also create ACADEMICA record
    if (tipoUsuario === 'BENEFICIARIO' && nivel) {
      const academicaId = `acad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      await query(
        `INSERT INTO "ACADEMICA" (
          "_id", "visitorId", "numeroId", "nivel", "step", "contrato",
          "origen", "_createdDate", "_updatedDate"
        ) VALUES ($1, $2, $3, $4, $5, $6, 'POSTGRES', NOW(), NOW())`,
        [academicaId, personId, numeroId, nivel, step || 'Step 1', contrato]
      )

      console.log('✅ [PostgreSQL] ACADEMICA record created:', academicaId)
    }

    return NextResponse.json({
      success: true,
      person: result.rows[0],
      message: 'Persona creada exitosamente'
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error creating person:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error creating person' },
      { status: 500 }
    )
  }
}
