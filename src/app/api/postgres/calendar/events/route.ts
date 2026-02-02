import { NextRequest, NextResponse } from 'next/server'
import { queryMany } from '@/lib/postgres'

/**
 * Get Calendar Events (PostgreSQL)
 * Query parameters:
 * - month: YYYY-MM (optional, defaults to current month)
 * - startDate: YYYY-MM-DD (optional)
 * - endDate: YYYY-MM-DD (optional)
 * - tipo: Event type filter (optional)
 * - advisor: Advisor email filter (optional)
 * - nivel: Level filter (optional)
 * - limit: Max results (default 500)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const month = searchParams.get('month')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const tipo = searchParams.get('tipo')
    const advisor = searchParams.get('advisor')
    const nivel = searchParams.get('nivel')
    const limit = parseInt(searchParams.get('limit') || '500')

    console.log('🔍 [PostgreSQL Calendar] Filters:', { month, startDate, endDate, tipo, advisor, nivel, limit })

    // Build dynamic WHERE clause
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date filters (using "dia" column which is timestamp)
    if (month) {
      // Month format: YYYY-MM
      const [year, monthNum] = month.split('-')
      const firstDay = `${year}-${monthNum}-01T00:00:00.000Z`
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate()
      const lastDayTimestamp = `${year}-${monthNum}-${lastDay.toString().padStart(2, '0')}T23:59:59.999Z`

      conditions.push(`c."dia" >= $${paramIndex}::timestamp`)
      params.push(firstDay)
      paramIndex++

      conditions.push(`c."dia" <= $${paramIndex}::timestamp`)
      params.push(lastDayTimestamp)
      paramIndex++
    } else if (startDate && endDate) {
      conditions.push(`c."dia" >= $${paramIndex}::timestamp`)
      params.push(`${startDate}T00:00:00.000Z`)
      paramIndex++

      conditions.push(`c."dia" <= $${paramIndex}::timestamp`)
      params.push(`${endDate}T23:59:59.999Z`)
      paramIndex++
    }

    // Type filter
    if (tipo) {
      conditions.push(`c."tipo" = $${paramIndex}`)
      params.push(tipo)
      paramIndex++
    }

    // Advisor filter
    if (advisor) {
      conditions.push(`LOWER(c."advisor") = LOWER($${paramIndex})`)
      params.push(advisor)
      paramIndex++
    }

    // Level filter
    if (nivel) {
      conditions.push(`c."nivel" = $${paramIndex}`)
      params.push(nivel)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const query = `
      SELECT
        c."_id",
        c."tipo",
        c."fecha",
        c."hora",
        c."advisor",
        c."nivel",
        c."step",
        c."club",
        c."titulo",
        c."observaciones",
        c."linkZoom",
        c."limiteUsuarios",
        c."inscritos",
        c."origen",
        c."dia",
        c."evento",
        c."nombreEvento",
        c."tituloONivel",
        c."_createdDate",
        c."_updatedDate",
        a."primerNombre" as "advisorPrimerNombre",
        a."primerApellido" as "advisorPrimerApellido",
        a."nombreCompleto" as "advisorNombreCompleto",
        a."email" as "advisorEmail"
      FROM "CALENDARIO" c
      LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
      ${whereClause}
      ORDER BY c."dia" DESC
      LIMIT $${paramIndex}
    `

    params.push(limit)

    console.log('🔍 [PostgreSQL Calendar] Query:', query)
    console.log('🔍 [PostgreSQL Calendar] Params:', params)

    const events = await queryMany(query, params)

    console.log('✅ [PostgreSQL Calendar] Found', events.length, 'events')

    return NextResponse.json({
      success: true,
      data: events,
      total: events.length,
      filters: {
        month,
        startDate,
        endDate,
        tipo,
        advisor,
        nivel,
      },
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL Calendar] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
