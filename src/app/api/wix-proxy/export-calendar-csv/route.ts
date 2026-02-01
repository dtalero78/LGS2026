import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    console.log('📥 [PostgreSQL] Exporting calendar events to CSV:', { fechaInicio, fechaFin })

    // Fetch events from PostgreSQL with bookings count
    const result = await query(
      `SELECT
        c."_id",
        c."dia",
        c."hora",
        c."tipo",
        c."nivel",
        c."step",
        c."descripcion",
        c."advisor",
        c."cuposMaximos",
        a."primerNombre" as "advisorNombre",
        a."primerApellido" as "advisorApellido",
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id") as "inscritos",
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" ab WHERE ab."eventoId" = c."_id" AND ab."asistio" = true) as "asistieron"
      FROM "CALENDARIO" c
      LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
      WHERE c."dia" >= $1::timestamp with time zone
        AND c."dia" <= $2::timestamp with time zone
      ORDER BY c."dia" ASC`,
      [fechaInicio, fechaFin]
    )

    console.log('📊 [PostgreSQL] Events found:', result.rowCount)

    // Generate CSV content
    const headers = [
      'ID',
      'Fecha',
      'Hora',
      'Tipo',
      'Nivel',
      'Step',
      'Descripción',
      'Advisor',
      'Cupos Máximos',
      'Inscritos',
      'Asistieron'
    ]

    const rows = result.rows.map((event: any) => {
      const fecha = event.dia ? new Date(event.dia).toLocaleDateString('es-CL') : ''
      const advisorName = [event.advisorNombre, event.advisorApellido].filter(Boolean).join(' ') || 'Sin asignar'

      return [
        event._id || '',
        fecha,
        event.hora || '',
        event.tipo || '',
        event.nivel || '',
        event.step || '',
        (event.descripcion || '').replace(/"/g, '""'),
        advisorName,
        event.cuposMaximos || '',
        event.inscritos || 0,
        event.asistieron || 0
      ]
    })

    // Build CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    console.log('✅ [PostgreSQL] CSV export successful, size:', csvContent.length)

    // Return as blob for download
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="eventos_${fechaInicio}_${fechaFin}.csv"`
      }
    })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error in export-calendar-csv API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
