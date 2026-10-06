import 'server-only'
import { successResponse } from '@/lib/api-helpers'
import { handlerReport } from '@/lib/report-guard'
import { requirePermission } from '@/lib/api-permissions'
import { query } from '@/lib/postgres'
import { InformesPermission } from '@/types/permissions'

/**
 * GET /api/postgres/reports/academica/certificados?nivel&plataforma&origen&startDate&endDate
 *
 * Certificados de nivel generados (CERTIFICADOS_LOG, una fila por descarga).
 * Una fila por estudiante + nivel de certificado con las veces que lo generó el
 * ESTUDIANTE (panel estudiante, límite 1) y las veces que lo generó un ADMIN
 * (detalle del estudiante, sin límite), primera/última generación y el último admin.
 *
 * Filtros:
 *   - nivel:      beginner | practical | functional (vacío = todos)
 *   - plataforma: ACADEMICA.plataforma exacta (vacío = todas)
 *   - origen:     ESTUDIANTE | ADMIN → solo filas con al menos una generación de ese origen
 *   - startDate/endDate: rango por fecha de generación (hora Colombia)
 *
 * ⚠️ El registro de generaciones por ADMIN empezó el 2026-10-05; las de estudiante
 * vienen desde el 2026-09-23 (backfill desde CERTIFICADOS_GENERADOS).
 * Gateado por INFORMES.ACADEMICA.CERTIFICADOS (SUPER_ADMIN/ADMIN bypass).
 */

const NIVELES = ['beginner', 'practical', 'functional']
const GDATE = `(l."generadoEn" AT TIME ZONE 'America/Bogota')::date`

export const GET = handlerReport(async (req, _ctx, session) => {
  await requirePermission(session, InformesPermission.ACAD_CERTIFICADOS)

  const sp = new URL(req.url).searchParams
  const nivel      = NIVELES.includes((sp.get('nivel') || '').toLowerCase()) ? sp.get('nivel')!.toLowerCase() : null
  const plataforma = (sp.get('plataforma') || '').trim() || null
  const origenRaw  = (sp.get('origen') || '').toUpperCase()
  const origen     = origenRaw === 'ESTUDIANTE' || origenRaw === 'ADMIN' ? origenRaw : null
  const startDate  = sp.get('startDate') || null
  const endDate    = sp.get('endDate') || null

  const where: string[] = []
  const params: any[] = []
  if (nivel)     { params.push(nivel);     where.push(`l."nivel" = $${params.length}`) }
  if (startDate) { params.push(startDate); where.push(`${GDATE} >= $${params.length}::date`) }
  if (endDate)   { params.push(endDate);   where.push(`${GDATE} <= $${params.length}::date`) }
  const having: string[] = []
  if (origen === 'ESTUDIANTE') having.push(`COUNT(*) FILTER (WHERE l."origen" = 'ESTUDIANTE') > 0`)
  if (origen === 'ADMIN')      having.push(`COUNT(*) FILTER (WHERE l."origen" = 'ADMIN') > 0`)
  let platCond = ''
  if (plataforma) { params.push(plataforma); platCond = `WHERE a."plataforma" = $${params.length}` }

  const { rows } = await query(`
    WITH g AS (
      SELECT l."studentId", l."nivel",
             COUNT(*) FILTER (WHERE l."origen" = 'ESTUDIANTE')::int AS "vecesEstudiante",
             COUNT(*) FILTER (WHERE l."origen" = 'ADMIN')::int      AS "vecesAdmin",
             MIN(l."generadoEn") AS "primera",
             MAX(l."generadoEn") AS "ultima",
             (ARRAY_AGG(l."generadoPor" ORDER BY l."generadoEn" DESC) FILTER (WHERE l."origen" = 'ADMIN'))[1] AS "ultimoAdmin",
             MAX(l."nombre") AS "nombreLog", MAX(l."numeroId") AS "numeroIdLog"
        FROM "CERTIFICADOS_LOG" l
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY l."studentId", l."nivel"
       ${having.length ? 'HAVING ' + having.join(' AND ') : ''}
    )
    SELECT g.*,
           TRIM(REGEXP_REPLACE(CONCAT_WS(' ', a."primerNombre", a."segundoNombre", a."primerApellido", a."segundoApellido"), '\\s+', ' ', 'g')) AS "nombre",
           a."numeroId", a."plataforma", a."contrato", a."nivel" AS "nivelActual", a."step" AS "stepActual",
           COALESCE(NULLIF(TRIM(u."nombre"), ''), g."ultimoAdmin") AS "ultimoAdminNombre"
      FROM g
      LEFT JOIN "ACADEMICA" a ON a."_id" = g."studentId"
      LEFT JOIN LATERAL (
        SELECT "nombre" FROM "USUARIOS_ROLES" WHERE g."ultimoAdmin" IS NOT NULL AND LOWER("email") = LOWER(g."ultimoAdmin") LIMIT 1
      ) u ON true
      ${platCond}
     ORDER BY g."ultima" DESC`, params)

  const out = rows.map((r: any) => ({
    studentId: r.studentId,
    nombre: r.nombre || r.nombreLog || '',
    numeroId: r.numeroId || r.numeroIdLog || '',
    plataforma: r.plataforma || null,
    contrato: r.contrato || null,
    nivelActual: r.nivelActual || null,
    stepActual: r.stepActual || null,
    nivel: r.nivel,
    vecesEstudiante: r.vecesEstudiante,
    vecesAdmin: r.vecesAdmin,
    primera: r.primera,
    ultima: r.ultima,
    ultimoAdmin: r.ultimoAdminNombre || null,
  }))

  const resumen = NIVELES.map(n => {
    const f = out.filter(r => r.nivel === n)
    return {
      nivel: n,
      estudiantes: f.length,
      porEstudiante: f.reduce((s, r) => s + r.vecesEstudiante, 0),
      porAdmin: f.reduce((s, r) => s + r.vecesAdmin, 0),
    }
  })
  const { rows: plats } = await query(
    `SELECT DISTINCT a."plataforma" FROM "CERTIFICADOS_LOG" l JOIN "ACADEMICA" a ON a."_id" = l."studentId"
      WHERE COALESCE(a."plataforma",'') <> '' ORDER BY 1`)

  return successResponse({
    rows: out,
    total: out.length,
    resumen,
    plataformas: plats.map((p: any) => p.plataforma),
    meta: { nivel, plataforma, origen, startDate, endDate },
  })
})
