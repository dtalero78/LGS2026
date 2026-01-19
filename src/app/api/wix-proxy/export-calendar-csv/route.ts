import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    console.log('📥 Exporting calendar events to CSV:', { fechaInicio, fechaFin })

    const response = await fetch(
      `${WIX_API_BASE_URL}/exportCSV?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
        }
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error exporting CSV:', response.status)
      return NextResponse.json(
        { success: false, error: `Error exporting CSV: ${response.status}` },
        { status: response.status }
      )
    }

    // Obtener el contenido CSV
    const csvContent = await response.text()
    console.log('✅ CSV export successful, size:', csvContent.length)

    // Devolver como blob para descarga
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="eventos_${fechaInicio}_${fechaFin}.csv"`
      }
    })

  } catch (error) {
    console.error('❌ Error in export-calendar-csv API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}