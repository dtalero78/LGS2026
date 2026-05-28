import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { query } from '@/lib/postgres'
import { InformesPermission } from '@/types/permissions'

/**
 * GET /api/postgres/reports/academica/x-niveles?nivel&startDate&endDate
 *
 * Listado de usuarios en ACADEMICA por nivel. Columnas: nombre, id (numeroId),
 * correo, nivel, step. Conteo total + desglose por nivel.
 *
 * Filtros:
 *   - nivel: código exacto (BN1, BN2, …, DONE) o vacío/'todos' = todos.
 *   - startDate/endDate (opcionales): rango por fecha de contrato
 *     (COALESCE fechaContrato, _createdDate). Vacíos = sin filtro de fecha.
 *
 * Gateado por INFORMES.ACADEMICA.X_NIVELES (SUPER_ADMIN/ADMIN bypass).
 */

const CDATE = `COALESCE("fechaContrato", ("_createdDate" AT TIME ZONE 'America/Bogota')::date)`
const MAX_ROWS = 8000

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, InformesPermission.ACAD_X_NIVELES)

  const { searchParams } = new URL(req.url)
  const nivelRaw  = (searchParams.get('nivel') || '').trim()
  const nivel     = nivelRaw && nivelRaw.toLowerCase() !== 'todos' ? nivelRaw : null
  const startDate = searchParams.get('startDate') || null
  const endDate   = searchParams.get('endDate') || null

  // $1 nivel, $2 startDate, $3 endDate (todos opcionales)
  const where = `
    "nivel" IS NOT NULL AND TRIM("nivel") <> ''
    AND ($1::text IS NULL OR "nivel" = $1)
    AND ($2::date IS NULL OR ${CDATE} >= $2::date)
    AND ($3::date IS NULL OR ${CDATE} <= $3::date)`
  const params = [nivel, startDate, endDate]

  const rowsRes = await query<any>(`
    SELECT
      TRIM(CONCAT(COALESCE("primerNombre",''), ' ', COALESCE("primerApellido",''))) AS nombre,
      "numeroId" AS id,
      "email" AS correo,
      "nivel",
      "step"
    FROM "ACADEMICA"
    WHERE ${where}
    ORDER BY "nivel" ASC,
      NULLIF(REGEXP_REPLACE(COALESCE("step",''), '[^0-9]', '', 'g'), '')::int ASC NULLS LAST,
      nombre ASC
    LIMIT ${MAX_ROWS}`, params)

  const totalRes = await query<{ n: number }>(`SELECT COUNT(*)::int n FROM "ACADEMICA" WHERE ${where}`, params)
  const total = Number(totalRes.rows[0]?.n) || 0

  // Desglose por nivel (respeta el filtro de fecha; ignora el de nivel para mostrar el panorama)
  const porNivelRes = await query<{ nivel: string; n: number }>(`
    SELECT "nivel", COUNT(*)::int n FROM "ACADEMICA"
    WHERE "nivel" IS NOT NULL AND TRIM("nivel") <> ''
      AND ($1::date IS NULL OR ${CDATE} >= $1::date)
      AND ($2::date IS NULL OR ${CDATE} <= $2::date)
    GROUP BY "nivel" ORDER BY n DESC`, [startDate, endDate])

  // Niveles disponibles para el dropdown
  const nivelesRes = await query<{ nivel: string }>(`
    SELECT DISTINCT "nivel" FROM "ACADEMICA" WHERE "nivel" IS NOT NULL AND TRIM("nivel") <> '' ORDER BY 1`)

  return successResponse({
    rows: rowsRes.rows,
    total,
    capped: total > MAX_ROWS,
    maxRows: MAX_ROWS,
    porNivel: porNivelRes.rows.map(r => ({ nivel: r.nivel, n: Number(r.n) })),
    meta: { niveles: nivelesRes.rows.map(r => r.nivel), nivel: nivel ?? '', startDate: startDate ?? '', endDate: endDate ?? '' },
  })
})
