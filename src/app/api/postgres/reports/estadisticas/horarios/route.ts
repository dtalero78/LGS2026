import 'server-only'
import { handler, successResponse } from '@/lib/api-helpers'
import { queryMany } from '@/lib/postgres'

async function safeQuery<T>(fn: () => Promise<T[]>, fallback: T[] = []): Promise<T[]> {
  try { return await fn() } catch (e) { console.error(e); return fallback }
}

export const GET = handler(async (req) => {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate') || '2020-01-01'
  const endDate   = searchParams.get('endDate')   || '2030-12-31'

  const params = [startDate, endDate]

  const baseWhere = `
    "fechaAgendamiento" IS NOT NULL
    AND "fechaAgendamiento" >= $1::date
    AND "fechaAgendamiento" < ($2::date + INTERVAL '1 day')
    AND ("cancelo" IS NULL OR "cancelo" = false)
    AND "origen" IN ('PANEL_EST', 'POSTGRES', 'COMP')
    AND COALESCE("tipo", "tipoEvento", '') NOT IN ('COMPLEMENTARIA', 'WELCOME')
    AND COALESCE("nivel", '') != 'WELCOME'
    AND EXTRACT(HOUR FROM "fechaAgendamiento" AT TIME ZONE 'America/Bogota') BETWEEN 6 AND 22
  `

  const [porHora, porDia, heatmap, porPlataforma] = await Promise.all([

    // Bookings por hora del día (zona horaria Bogotá UTC-5)
    safeQuery(() => queryMany(`
      SELECT
        EXTRACT(HOUR FROM "fechaAgendamiento" AT TIME ZONE 'America/Bogota')::int AS hora,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1
      ORDER BY 1
    `, params)),

    // Bookings por día de la semana (ISO: 1=Lun ... 7=Dom)
    safeQuery(() => queryMany(`
      SELECT
        EXTRACT(ISODOW FROM "fechaAgendamiento" AT TIME ZONE 'America/Bogota')::int AS dow,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1
      ORDER BY 1
    `, params)),

    // Heatmap: hora × día de semana
    safeQuery(() => queryMany(`
      SELECT
        EXTRACT(ISODOW FROM "fechaAgendamiento" AT TIME ZONE 'America/Bogota')::int AS dow,
        EXTRACT(HOUR FROM "fechaAgendamiento" AT TIME ZONE 'America/Bogota')::int   AS hora,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, params)),

    // Por plataforma × hora (para top-horas por país)
    safeQuery(() => queryMany(`
      SELECT
        COALESCE("plataforma", 'Sin país') AS plataforma,
        EXTRACT(HOUR FROM "fechaAgendamiento" AT TIME ZONE 'America/Bogota')::int AS hora,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, params)),
  ])

  return successResponse({ porHora, porDia, heatmap, porPlataforma })
})
