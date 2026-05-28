import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { queryMany } from '@/lib/postgres'
import { InformesPermission } from '@/types/permissions'

/**
 * GET /api/postgres/reports/academica/horas-advisor
 *
 * Informe de horas Advisor: por cada advisor cuenta sus sesiones por estado
 * en un rango de fechas, con filtro opcional de plataforma (ADVISORS.pais) y advisor.
 *
 *   - Conducted  = eventos vigentes en CALENDARIO asignados al advisor
 *   - Cancelled  = ADVISOR_EVENT_LOG estado='Canceled'  (cambio de advisor)
 *   - Suspended  = ADVISOR_EVENT_LOG estado='Suspended' (cancelación del evento)
 *   - Total      = conducted + suspended + cancelled
 *
 * El numeroId del advisor no vive en ADVISORS; se resuelve vía USUARIOS_ROLES.numberid
 * por email (puede ser null para advisors sin cuenta migrada).
 *
 * Gateado por INFORMES.ACADEMICA.HORAS_ADVISOR (SUPER_ADMIN/ADMIN bypass).
 */

interface HorasAdvisorRow {
  advisorId: string
  advisorNombre: string
  plataforma: string | null
  numeroId: string | null
  conducted: number
  suspended: number
  cancelled: number
  total: number
}

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, InformesPermission.ACAD_HORAS_ADVISOR)

  const { searchParams } = new URL(req.url)
  const fechaInicio = searchParams.get('fechaInicio') || `${new Date().getFullYear()}-01-01`
  const fechaFin    = searchParams.get('fechaFin')    || new Date().toISOString().substring(0, 10)
  const plataforma  = searchParams.get('plataforma')  || null
  const advisorId   = searchParams.get('advisorId')   || null

  const params: any[] = [fechaInicio, fechaFin, plataforma, advisorId]

  const sql = `
    WITH conducted AS (
      SELECT a."_id" AS advisor_id, COUNT(*)::int AS conducted
      FROM "CALENDARIO" c
      JOIN "ADVISORS" a
        ON a."_id" = c."advisor" OR LOWER(a."email") = LOWER(c."advisor")
      WHERE c."dia" >= $1::date AND c."dia" < ($2::date + interval '1 day')
      GROUP BY a."_id"
    ),
    logs AS (
      SELECT a."_id" AS advisor_id,
        COUNT(*) FILTER (WHERE l."estado" = 'Canceled')::int  AS cancelled,
        COUNT(*) FILTER (WHERE l."estado" = 'Suspended')::int AS suspended
      FROM "ADVISOR_EVENT_LOG" l
      JOIN "ADVISORS" a
        ON a."_id" = l."advisorId" OR LOWER(a."email") = LOWER(l."advisorId")
      WHERE l."fechaEvento" >= $1::date AND l."fechaEvento" < ($2::date + interval '1 day')
      GROUP BY a."_id"
    ),
    combined AS (
      SELECT advisor_id FROM conducted
      UNION
      SELECT advisor_id FROM logs
    )
    SELECT
      a."_id" AS "advisorId",
      COALESCE(NULLIF(TRIM(a."nombreCompleto"), ''),
               NULLIF(TRIM(CONCAT(a."primerNombre", ' ', a."primerApellido")), ''),
               a."_id") AS "advisorNombre",
      a."pais" AS "plataforma",
      ur."numeroId" AS "numeroId",
      COALESCE(co.conducted, 0) AS "conducted",
      COALESCE(lo.suspended, 0) AS "suspended",
      COALESCE(lo.cancelled, 0) AS "cancelled",
      COALESCE(co.conducted, 0) + COALESCE(lo.suspended, 0) + COALESCE(lo.cancelled, 0) AS "total"
    FROM combined cb
    JOIN "ADVISORS" a ON a."_id" = cb.advisor_id
    LEFT JOIN conducted co ON co.advisor_id = a."_id"
    LEFT JOIN logs lo ON lo.advisor_id = a."_id"
    LEFT JOIN LATERAL (
      SELECT "numberid" AS "numeroId"
      FROM "USUARIOS_ROLES"
      WHERE LOWER("email") = LOWER(a."email") AND "numberid" IS NOT NULL
      LIMIT 1
    ) ur ON true
    WHERE ($3::text IS NULL OR a."pais" = $3)
      AND ($4::text IS NULL OR a."_id" = $4)
    ORDER BY "total" DESC, "advisorNombre" ASC
  `

  const rows = await queryMany<HorasAdvisorRow>(sql, params)

  // ── Totales ──
  const totals = {
    conducted: rows.reduce((s, r) => s + Number(r.conducted), 0),
    suspended: rows.reduce((s, r) => s + Number(r.suspended), 0),
    cancelled: rows.reduce((s, r) => s + Number(r.cancelled), 0),
    total:     rows.reduce((s, r) => s + Number(r.total), 0),
  }

  // ── Charts ──
  // Barras horizontales: una entrada por advisor con los 3 estados
  const barByAdvisor = rows.map(r => ({
    name:     r.advisorNombre.length > 18 ? `${r.advisorNombre.slice(0, 17)}…` : r.advisorNombre,
    fullName: r.advisorNombre,
    conducted: Number(r.conducted),
    suspended: Number(r.suspended),
    cancelled: Number(r.cancelled),
  }))

  // Donut: total + 3 estados con % respecto al total
  const donut = [
    { name: 'Conducted', value: totals.conducted },
    { name: 'Suspended', value: totals.suspended },
    { name: 'Cancelled', value: totals.cancelled },
  ].filter(d => d.value > 0)

  // ── Meta dropdowns ──
  const plataformas = await queryMany<{ pais: string }>(
    `SELECT DISTINCT "pais" FROM "ADVISORS" WHERE "pais" IS NOT NULL AND TRIM("pais") <> '' ORDER BY "pais"`,
    [],
  )
  const advisors = await queryMany<{ _id: string; nombreCompleto: string; pais: string | null }>(
    `SELECT "_id", "nombreCompleto", "pais" FROM "ADVISORS" WHERE "activo" = true ORDER BY "nombreCompleto"`,
    [],
  )

  return successResponse({
    table: rows,
    totals,
    charts: { barByAdvisor, donut },
    meta: { plataformas: plataformas.map(p => p.pais), advisors },
  })
})
