import { NextRequest, NextResponse } from 'next/server'
import { getFinancialDataByContract, makeWixApiCall } from '@/lib/wix'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personId = params.id

    if (!personId) {
      return NextResponse.json({
        success: false,
        error: 'Person ID is required'
      }, { status: 400 })
    }

    // Get person data from Wix
    const personData = await makeWixApiCall(`personById?id=${encodeURIComponent(personId)}`)

    if (!personData.success || !personData.person) {
      return NextResponse.json({
        success: false,
        error: 'Person not found',
        source: 'wix'
      }, { status: 404 })
    }

    let financialData = null
    let beneficiaries = []

    // Get financial data if contract exists
    if (personData.person.contrato) {
      try {
        const financialResponse = await getFinancialDataByContract(personData.person.contrato)
        if (financialResponse.success) {
          financialData = financialResponse.financialData
        }
      } catch (error) {
        console.error('Error fetching financial data:', error)
      }
    }

    // Get related persons (beneficiaries) from Wix
    try {
      const relatedData = await makeWixApiCall('getRelatedPersons', 'POST', {
        personId: personId,
        tipoUsuario: personData.person.tipoUsuario,
        titularId: personData.person.titularId
      })

      if (relatedData.success && relatedData.relatedPersons) {
        beneficiaries = relatedData.relatedPersons.map((person: any) => ({
          _id: person._id,
          numeroId: person.numeroId,
          nombre: person.nombreCompleto.split(' ')[0] || '',
          apellido: person.nombreCompleto.split(' ').slice(1).join(' ') || '',
          estado: person.aprobacion,
          fechaCreacion: person._createdDate,
          nivel: person.nivel,
          existeEnAcademica: person.existeEnAcademica
        }))
      }
    } catch (error) {
      console.error('Error fetching related persons:', error)
      beneficiaries = []
    }

    return NextResponse.json({
      success: true,
      person: personData.person,
      financialData,
      beneficiaries,
      source: 'wix'
    })

  } catch (error) {
    console.error('Error fetching person:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}