import 'server-only'
import { handler, successResponse } from '@/lib/api-helpers'
import { queryMany } from '@/lib/postgres'

async function safeQuery<T>(fn: () => Promise<T[]>, fallback: T[] = []): Promise<T[]> {
  try { return await fn() } catch (e) { console.error(e); return fallback }
}

/**
 * Valida que el timezone sea un string IANA válido (solo caracteres permitidos).
 * PostgreSQL lanzará error si el valor no es un timezone reconocido,
 * lo cual queda atrapado por safeQuery. La regex previene inyección SQL.
 */
function sanitizeTz(raw: string | null): string {
  const fallback = 'America/Bogota'
  if (!raw) return fallback
  return /^[A-Za-z_\/+\-0-9]+$/.test(raw) ? raw : fallback
}

export const GET = handler(async (req) => {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate') || '2020-01-01'
  const endDate   = searchParams.get('endDate')   || '2030-12-31'
  const tz        = sanitizeTz(searchParams.get('tz'))

  const params = [startDate, endDate]

  // Todos los cálculos de hora/día usan la zona horaria del cliente (tz).
  // AT TIME ZONE tz convierte el timestamp UTC almacenado a la hora local del usuario.
  const baseWhere = `
    "fechaAgendamiento" IS NOT NULL
    AND "fechaAgendamiento" >= $1::date
    AND "fechaAgendamiento" < ($2::date + INTERVAL '1 day')
    AND ("cancelo" IS NULL OR "cancelo" = false)
    AND "origen" IN ('PANEL_EST', 'POSTGRES', 'COMP')
    AND COALESCE("tipo", "tipoEvento", '') NOT IN ('COMPLEMENTARIA', 'WELCOME')
    AND COALESCE("nivel", '') != 'WELCOME'
    AND EXTRACT(HOUR FROM "fechaAgendamiento" AT TIME ZONE '${tz}') BETWEEN 6 AND 22
  `

  const [porHora, porDia, heatmap, porPlataforma] = await Promise.all([

    // Por hora del día en la zona horaria del cliente
    safeQuery(() => queryMany(`
      SELECT
        EXTRACT(HOUR FROM "fechaAgendamiento" AT TIME ZONE '${tz}')::int AS hora,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1
      ORDER BY 1
    `, params)),

    // Por día de la semana en la zona horaria del cliente (ISO: 1=Lun … 7=Dom)
    safeQuery(() => queryMany(`
      SELECT
        EXTRACT(ISODOW FROM "fechaAgendamiento" AT TIME ZONE '${tz}')::int AS dow,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1
      ORDER BY 1
    `, params)),

    // Heatmap: hora × día de semana en la zona horaria del cliente
    safeQuery(() => queryMany(`
      SELECT
        EXTRACT(ISODOW FROM "fechaAgendamiento" AT TIME ZONE '${tz}')::int AS dow,
        EXTRACT(HOUR  FROM "fechaAgendamiento" AT TIME ZONE '${tz}')::int AS hora,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, params)),

    // Por plataforma × hora en la zona horaria del cliente
    safeQuery(() => queryMany(`
      SELECT
        COALESCE("plataforma", 'Sin país') AS plataforma,
        EXTRACT(HOUR FROM "fechaAgendamiento" AT TIME ZONE '${tz}')::int AS hora,
        COUNT(*)::int AS total
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${baseWhere}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, params)),
  ])

  return successResponse({ porHora, porDia, heatmap, porPlataforma, tz })
})
