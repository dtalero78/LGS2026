import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { query } from '@/lib/postgres'
import { MantenimientoPermission } from '@/types/permissions'

/**
 * GET /api/admin/contratos-prueba/list
 *   ?search=&plataforma=&fechaDesde=&fechaHasta=
 *
 * Lista los contratos con prefijo PRB-, agrupados por contrato (1 fila por
 * número de contrato = 1 titular). Cada fila incluye los conteos de filas
 * dependientes en cada tabla afectada por la purga, para que el admin tenga
 * preview ANTES de borrar.
 *
 * Gateado por MANTENIMIENTO.USUARIOS.CONTRATOS_PRUEBA.
 */
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CONTRATOS_PRUEBA)

  const { searchParams } = new URL(req.url)
  const search      = (searchParams.get('search') || '').trim()
  const plataforma  = (searchParams.get('plataforma') || '').trim()
  const fechaDesde  = (searchParams.get('fechaDesde') || '').trim()
  const fechaHasta  = (searchParams.get('fechaHasta') || '').trim()

  const conds: string[] = [`p."contrato" LIKE 'PRB-%'`, `p."tipoUsuario" = 'TITULAR'`]
  const params: any[] = []
  let i = 1
  if (search) {
    conds.push(`(p."primerNombre" ILIKE $${i} OR p."primerApellido" ILIKE $${i} OR p."numeroId" ILIKE $${i} OR p."contrato" ILIKE $${i})`)
    params.push(`%${search}%`); i++
  }
  if (plataforma) { conds.push(`p."plataforma" = $${i}`); params.push(plataforma); i++ }
  if (fechaDesde) { conds.push(`COALESCE(p."fechaContrato", (p."_createdDate" AT TIME ZONE 'America/Bogota')::date) >= $${i}::date`); params.push(fechaDesde); i++ }
  if (fechaHasta) { conds.push(`COALESCE(p."fechaContrato", (p."_createdDate" AT TIME ZONE 'America/Bogota')::date) <= $${i}::date`); params.push(fechaHasta); i++ }

  const rows = await query<any>(`
    SELECT
      p."_id"             AS "titularId",
      p."contrato",
      p."primerNombre",
      p."primerApellido",
      p."numeroId",
      p."plataforma",
      p."email",
      p."asesor",
      COALESCE(p."fechaContrato", (p."_createdDate" AT TIME ZONE 'America/Bogota')::date) AS "fechaContrato",
      (SELECT COUNT(*) FROM "PEOPLE" p2 WHERE p2."contrato" = p."contrato" AND p2."tipoUsuario" <> 'TITULAR') AS "beneficiarios"
    FROM "PEOPLE" p
    WHERE ${conds.join(' AND ')}
    ORDER BY p."_createdDate" DESC NULLS LAST
    LIMIT 500
  `, params)

  // Plataformas disponibles para el dropdown
  const plataformasRes = await query<{ plataforma: string }>(`
    SELECT DISTINCT "plataforma" FROM "PEOPLE"
    WHERE "contrato" LIKE 'PRB-%' AND "plataforma" IS NOT NULL AND TRIM("plataforma") <> ''
    ORDER BY "plataforma"`)
  const plataformas = plataformasRes.rows.map(r => r.plataforma)

  return successResponse({
    rows: rows.rows.map(r => ({
      titularId: r.titularId,
      contrato: r.contrato,
      nombre: `${r.primerNombre ?? ''} ${r.primerApellido ?? ''}`.trim(),
      numeroId: r.numeroId,
      plataforma: r.plataforma,
      email: r.email,
      asesor: r.asesor,
      fechaContrato: r.fechaContrato,
      beneficiarios: Number(r.beneficiarios) || 0,
    })),
    plataformas,
    total: rows.rows.length,
  })
})
