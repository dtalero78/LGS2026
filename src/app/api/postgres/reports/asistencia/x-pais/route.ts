import 'server-only'
import { handler, successResponse } from '@/lib/api-helpers'
import { queryMany } from '@/lib/postgres'

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch (e) { console.error(e); return fallback }
}

const STEP_EXTRACT = `
  CAST(
    NULLIF(
      REGEXP_REPLACE(
        COALESCE("nombreEvento", "step", ''),
        '^.*[Ss]tep\\s+([0-9]+).*$',
        '\\1'
      ),
      COALESCE("nombreEvento", "step", '')
    ) AS INTEGER
  )
`

// Suma los totales de todas las filas por plataforma
function agg(rows: any[]) {
  return rows.reduce(
    (a, r) => ({
      total:       a.total       + (r.total       || 0),
      asistieron:  a.asistieron  + (r.asistieron  || 0),
      cancelaron:  a.cancelaron  + (r.cancelaron  || 0),
      aprobaron:   a.aprobaron   + (r.aprobaron   || 0),
      noAprobaron: a.noAprobaron + (r.noAprobaron || 0),
    }),
    { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0 }
  )
}

export const GET = handler(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') || '2020-01-01'
  const endDate   = searchParams.get('endDate')   || '2030-12-31'
  const p = [startDate, endDate]

  const dateWhere = `
    "fechaEvento" >= $1::date
    AND "fechaEvento" < ($2::date + INTERVAL '1 day')
  `

  const BASE_SELECT = `
    SELECT
      COALESCE("plataforma", 'Sin plataforma') AS plataforma,
      COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN "asistencia" = true OR "asistio" = true THEN 1 ELSE 0 END), 0)::int AS asistieron,
      COALESCE(SUM(CASE WHEN "cancelo" = true THEN 1 ELSE 0 END), 0)::int AS cancelaron
    FROM "ACADEMICA_BOOKINGS"
  `

  const [sesPorPlat, jmpPorPlat, trPorPlat, clPorPlat, welPorPlat, compPorPlat] = await Promise.all([

    // ── SESIONES: SESSION + step 0-45 excluyendo múltiplos de 5 ──────────
    safeQuery(() => queryMany<any>(`
      ${BASE_SELECT}
      WHERE ${dateWhere}
        AND COALESCE("tipo", "tipoEvento") = 'SESSION'
        AND COALESCE("nombreEvento", "step", '') ~* 'step\\s+[0-9]+'
        AND ${STEP_EXTRACT} BETWEEN 0 AND 45
        AND (${STEP_EXTRACT} = 0 OR ${STEP_EXTRACT} % 5 != 0)
      GROUP BY COALESCE("plataforma", 'Sin plataforma')
      ORDER BY total DESC
    `, p), []),

    // ── JUMPS: SESSION + step múltiplo de 5 ──────────────────────────────
    safeQuery(() => queryMany<any>(`
      SELECT
        COALESCE("plataforma", 'Sin plataforma') AS plataforma,
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN "asistencia" = true OR "asistio" = true THEN 1 ELSE 0 END), 0)::int AS asistieron,
        COALESCE(SUM(CASE WHEN "cancelo" = true THEN 1 ELSE 0 END), 0)::int AS cancelaron,
        COALESCE(SUM(CASE WHEN
          ("asistencia" = true OR "asistio" = true)
          AND "participacion" = true
          AND ("noAprobo" IS DISTINCT FROM true)
        THEN 1 ELSE 0 END), 0)::int AS aprobaron,
        COALESCE(SUM(CASE WHEN
          ("asistencia" = true OR "asistio" = true)
          AND "noAprobo" = true
        THEN 1 ELSE 0 END), 0)::int AS "noAprobaron"
      FROM "ACADEMICA_BOOKINGS"
      WHERE ${dateWhere}
        AND COALESCE("tipo", "tipoEvento") = 'SESSION'
        AND COALESCE("nombreEvento", "step", '') ~* 'step\\s+[0-9]+'
        AND ${STEP_EXTRACT} BETWEEN 1 AND 45
        AND ${STEP_EXTRACT} % 5 = 0
      GROUP BY COALESCE("plataforma", 'Sin plataforma')
      ORDER BY total DESC
    `, p), []),

    // ── TRAINING: CLUB + nombre empieza con TRAINING…Step ────────────────
    safeQuery(() => queryMany<any>(`
      ${BASE_SELECT}
      WHERE ${dateWhere}
        AND COALESCE("tipo", "tipoEvento") = 'CLUB'
        AND COALESCE("nombreEvento", "step", '') ~* '^TRAINING.*Step'
      GROUP BY COALESCE("plataforma", 'Sin plataforma')
      ORDER BY total DESC
    `, p), []),

    // ── CLUBES: CLUB + GRAMMAR/LISTENING/KARAOKE/PRONUNCIATION/CONVERSATION
    safeQuery(() => queryMany<any>(`
      ${BASE_SELECT}
      WHERE ${dateWhere}
        AND COALESCE("tipo", "tipoEvento") = 'CLUB'
        AND COALESCE("nombreEvento", "step", '') ~* '^(GRAMMAR|LISTENING|KARAOKE|PRONUNCIATION|CONVERSATION).*Step'
      GROUP BY COALESCE("plataforma", 'Sin plataforma')
      ORDER BY total DESC
    `, p), []),

    // ── WELCOME: nivel = WELCOME ──────────────────────────────────────────
    safeQuery(() => queryMany<any>(`
      ${BASE_SELECT}
      WHERE ${dateWhere}
        AND COALESCE("nivel", '') = 'WELCOME'
      GROUP BY COALESCE("plataforma", 'Sin plataforma')
      ORDER BY total DESC
    `, p), []),

    // ── COMPLEMENTARIAS: tipoEvento = COMPLEMENTARIA ─────────────────────
    safeQuery(() => queryMany<any>(`
      ${BASE_SELECT}
      WHERE ${dateWhere}
        AND COALESCE("tipo", "tipoEvento") = 'COMPLEMENTARIA'
      GROUP BY COALESCE("plataforma", 'Sin plataforma')
      ORDER BY total DESC
    `, p), []),
  ])

  return successResponse({
    sesiones:        { ...agg(sesPorPlat),  porPlataforma: sesPorPlat  },
    jumps:           { ...agg(jmpPorPlat),  porPlataforma: jmpPorPlat  },
    training:        { ...agg(trPorPlat),   porPlataforma: trPorPlat   },
    clubes:          { ...agg(clPorPlat),   porPlataforma: clPorPlat   },
    welcome:         { ...agg(welPorPlat),  porPlataforma: welPorPlat  },
    complementarias: { ...agg(compPorPlat), porPlataforma: compPorPlat },
  })
})
