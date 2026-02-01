import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { v4 as uuidv4 } from 'uuid'

// Contract country codes mapping
const CONTRACT_COUNTRY_CODES: Record<string, string> = {
  "Chile": "01",
  "Colombia": "02",
  "Ecuador": "03",
  "Perú": "04"
}

// Generate contract number format: XX-NNNNN-YY
async function generateContractNumber(country: string): Promise<string> {
  const countryCode = CONTRACT_COUNTRY_CODES[country]
  if (!countryCode) {
    throw new Error(`Invalid country for contract generation: ${country}`)
  }

  const currentYear = new Date().getFullYear().toString().slice(-2)
  const nextSequential = await getNextSequentialNumber(countryCode, currentYear)

  return `${countryCode}-${nextSequential}-${currentYear}`
}

// Get next sequential number for a country
async function getNextSequentialNumber(countryCode: string, year: string): Promise<string> {
  try {
    const result = await query(
      `SELECT "contrato" FROM "PEOPLE"
       WHERE "contrato" LIKE $1
       ORDER BY "contrato" DESC
       LIMIT 100`,
      [`${countryCode}-%`]
    )

    let maxNumber = 9999

    if (result.rows && result.rows.length > 0) {
      result.rows.forEach((row: any) => {
        if (row.contrato) {
          const parts = row.contrato.split('-')
          if (parts.length === 3) {
            const currentNumber = parseInt(parts[1], 10)
            if (!isNaN(currentNumber) && currentNumber > maxNumber) {
              maxNumber = currentNumber
            }
          }
        }
      })
    }

    const nextNumber = maxNumber + 1
    return nextNumber.toString().padStart(5, '0')
  } catch (error) {
    console.error('Error getting sequential number:', error)
    return '10000'
  }
}

// Calculate age from birth date
function calculateAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age
}

// Normalize and format monetary values
function formatMonetaryValue(value: number): string {
  return value.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

// Clean text (remove extra spaces)
function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

// Capitalize first letter
function capitalizeFirstLetter(text: string): string {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { titular, financial, beneficiarios = [], titularEsBeneficiario = false } = body

    console.log('📝 [PostgreSQL] Creating new contract')

    // Validate required fields for titular
    if (!titular || !titular.primerNombre || !titular.primerApellido || !titular.numeroId) {
      return NextResponse.json({
        error: 'Datos del titular incompletos'
      }, { status: 400 })
    }

    // Generate contract number
    const contractNumber = await generateContractNumber(titular.pais)
    console.log('📝 [PostgreSQL] Generated contract number:', contractNumber)

    // Calculate age
    const birthDate = new Date(titular.fechaNacimiento)
    const age = calculateAge(birthDate)

    // Generate unique ID for titular
    const titularId = uuidv4()

    // Insert titular into PEOPLE table
    const titularResult = await query(
      `INSERT INTO "PEOPLE" (
        "_id", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "numeroId", "fechaNacimiento", "edad", "plataforma", "domicilio",
        "ciudad", "celular", "ingresos", "email", "empresa",
        "cargo", "genero", "tipoUsuario", "telefono", "referenciaUno",
        "parentezcoRefUno", "telefonoRefUno", "referenciaDos", "telefonoRefDos", "parentezcoRefDos",
        "vigencia", "contrato", "asesorCreadorContrato", "_createdDate", "_updatedDate", "origen"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, NOW(), NOW(), 'POSTGRES'
      ) RETURNING *`,
      [
        titularId,
        capitalizeFirstLetter(titular.primerNombre),
        capitalizeFirstLetter(titular.segundoNombre || ''),
        capitalizeFirstLetter(titular.primerApellido),
        capitalizeFirstLetter(titular.segundoApellido || ''),
        cleanText(titular.numeroId),
        birthDate.toISOString().split('T')[0],
        age.toString(),
        titular.pais,
        titular.domicilio || '',
        titular.ciudad || '',
        cleanText(titular.celular || ''),
        titular.ingresos || '',
        titular.email || '',
        titular.empresa || '',
        capitalizeFirstLetter(titular.cargo || ''),
        titular.genero || '',
        'TITULAR',
        titular.telefono || '',
        capitalizeFirstLetter(titular.referenciaUno || ''),
        titular.parentezcoRefUno || '',
        titular.telRefUno || '',
        capitalizeFirstLetter(titular.referenciaDos || ''),
        titular.telRefDos || '',
        titular.parentezcoRefDos || '',
        financial?.vigencia || '',
        contractNumber,
        titular.asesorCreadorContrato || ''
      ]
    )

    const createdTitular = titularResult.rows[0]
    console.log('✅ [PostgreSQL] Titular created:', titularId)

    // Create financial record if provided
    if (financial) {
      const financialId = uuidv4()

      await query(
        `INSERT INTO "FINANCIEROS" (
          "_id", "titularId", "contrato", "primerNombre", "primerApellido",
          "numeroId", "totalPlan", "valorCuota", "pagoInscripcion", "saldo",
          "numeroCuotas", "fechaPago", "vigencia", "medioPago",
          "_createdDate", "_updatedDate", "origen"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, NOW(), NOW(), 'POSTGRES'
        )`,
        [
          financialId,
          titularId,
          contractNumber,
          capitalizeFirstLetter(titular.primerNombre),
          capitalizeFirstLetter(titular.primerApellido),
          cleanText(titular.numeroId),
          formatMonetaryValue(financial.totalPlan || 0),
          financial.numeroCuotas === 0 ? "0" : formatMonetaryValue(financial.valorCuota || 0),
          formatMonetaryValue(financial.pagoInscripcion || 0),
          formatMonetaryValue(financial.saldo || 0),
          financial.numeroCuotas || 0,
          financial.fechaPago || null,
          financial.vigencia || '',
          financial.medioPago || ''
        ]
      )

      console.log('✅ [PostgreSQL] Financial record created')
    }

    // Create beneficiario for titular if checkbox is checked
    const createdBeneficiarios = []
    if (titularEsBeneficiario) {
      const beneficiarioId = uuidv4()

      const beneficiarioResult = await query(
        `INSERT INTO "PEOPLE" (
          "_id", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
          "numeroId", "fechaNacimiento", "edad", "email", "celular",
          "tipoUsuario", "titularId", "contrato", "plataforma",
          "_createdDate", "_updatedDate", "origen"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, NOW(), NOW(), 'POSTGRES'
        ) RETURNING *`,
        [
          beneficiarioId,
          capitalizeFirstLetter(titular.primerNombre),
          capitalizeFirstLetter(titular.segundoNombre || ''),
          capitalizeFirstLetter(titular.primerApellido),
          capitalizeFirstLetter(titular.segundoApellido || ''),
          cleanText(titular.numeroId),
          birthDate.toISOString().split('T')[0],
          age.toString(),
          titular.email || '',
          cleanText(titular.celular || ''),
          'BENEFICIARIO',
          titularId,
          contractNumber,
          titular.pais
        ]
      )

      createdBeneficiarios.push(beneficiarioResult.rows[0])
      console.log('✅ [PostgreSQL] Titular as beneficiario created')
    }

    // Create beneficiarios if provided
    for (const beneficiario of beneficiarios) {
      const beneficiarioId = uuidv4()
      const beneficiarioBirthDate = new Date(beneficiario.fechaNacimiento)
      const beneficiarioAge = calculateAge(beneficiarioBirthDate)

      const beneficiarioResult = await query(
        `INSERT INTO "PEOPLE" (
          "_id", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
          "numeroId", "fechaNacimiento", "edad", "email", "celular",
          "tipoUsuario", "titularId", "contrato", "plataforma",
          "_createdDate", "_updatedDate", "origen"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, NOW(), NOW(), 'POSTGRES'
        ) RETURNING *`,
        [
          beneficiarioId,
          capitalizeFirstLetter(beneficiario.primerNombre),
          capitalizeFirstLetter(beneficiario.segundoNombre || ''),
          capitalizeFirstLetter(beneficiario.primerApellido),
          capitalizeFirstLetter(beneficiario.segundoApellido || ''),
          cleanText(beneficiario.numeroId),
          beneficiarioBirthDate.toISOString().split('T')[0],
          beneficiarioAge.toString(),
          beneficiario.email || '',
          cleanText(beneficiario.celular || ''),
          'BENEFICIARIO',
          titularId,
          contractNumber,
          beneficiario.plataforma || titular.pais
        ]
      )

      createdBeneficiarios.push(beneficiarioResult.rows[0])
    }

    console.log('✅ [PostgreSQL] Contract creation complete:', contractNumber)

    return NextResponse.json({
      success: true,
      data: {
        titular: createdTitular,
        contractNumber: contractNumber,
        beneficiarios: createdBeneficiarios
      }
    })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error creating contract:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating contract' },
      { status: 500 }
    )
  }
}
