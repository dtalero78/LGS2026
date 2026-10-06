import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { query } from '@/lib/postgres'
import { MantenimientoPermission } from '@/types/permissions'
import { categoriaDe, whereCategoria } from '@/lib/limpieza-anulados'

/**
 * GET /api/admin/limpieza-anulados/list?search=&plataforma=&minDias=
 *
 * Contratos ANULADOS (titular con estado ANULADO o aprobacion Contrato nulo /
 * Devuelto / Rechazado; nunca Aprobado ni PRB-), 1 fila por contrato, con lo
 * necesario para decidir antes de borrar:
 *   - beneficiarios, pagos (y cuántos VALIDADOS → esos se omiten al borrar)
 *   - docsCompartidos: documentos del contrato que también están en OTRO
 *     contrato (su ficha académica / clases / login se CONSERVAN al borrar)
 *   - minDias: solo anulados hace al menos N días (por _updatedDate del titular)
 * Gateado por MANTENIMIENTO.CONTRATOS.LIMPIEZA_ANULADOS.
 */
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LIMPIEZA_ANULADOS)

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const plataforma = (searchParams.get('plataforma') || '').trim()
  const minDias = Math.max(0, parseInt(searchParams.get('minDias') || '0', 10) || 0)
  const estado = (searchParams.get('estado') || '').trim()
  // categoria=retractados → pestaña "Retractados" (aparte de los nulos/devueltos/rechazados).
  const ANULADO_WHERE = whereCategoria(categoriaDe(searchParams.get('categoria')))

  const conds: string[] = [`p."tipoUsuario" = 'TITULAR'`, ANULADO_WHERE]
  const params: any[] = []
  let i = 1
  if (search) {
    conds.push(`(p."primerNombre" ILIKE $${i} OR p."primerApellido" ILIKE $${i} OR p."numeroId" ILIKE $${i} OR p."contrato" ILIKE $${i})`)
    params.push(`%${search}%`); i++
  }
  if (plataforma) { conds.push(`p."plataforma" = $${i}`); params.push(plataforma); i++ }
  if (minDias > 0) { conds.push(`p."_updatedDate" <= NOW() - ($${i}::int * INTERVAL '1 day')`); params.push(minDias); i++ }
  // Estado mostrado = aprobacion (Rechazado / Devuelto / Contrato nulo) o, si no hay, estado (ANULADO).
  if (estado) { conds.push(`COALESCE(NULLIF(p."aprobacion",''), p."estado") = $${i}`); params.push(estado); i++ }

  // Métricas precalculadas con UN GROUP BY cada una (las subconsultas por fila
  // recorrían PEOPLE una vez por contrato y superaban el statement_timeout de 30 s).
  const r = await query<any>(`
    WITH n AS (
      SELECT "contrato", UPPER(REGEXP_REPLACE(COALESCE("numeroId",''), '[.[:space:]_-]', '', 'g')) AS nid
        FROM "PEOPLE" WHERE COALESCE("numeroId",'') <> '' AND COALESCE("contrato",'') <> ''
    ),
    multi AS (SELECT nid FROM n GROUP BY nid HAVING COUNT(DISTINCT "contrato") > 1),
    comp  AS (SELECT n."contrato", COUNT(DISTINCT n.nid)::int AS docs FROM n JOIN multi USING (nid) GROUP BY n."contrato"),
    benef AS (SELECT "contrato", COUNT(*) FILTER (WHERE "tipoUsuario" <> 'TITULAR')::int AS b FROM "PEOPLE" GROUP BY "contrato"),
    pag   AS (SELECT x."contrato", COUNT(*)::int AS total, COUNT(*) FILTER (WHERE pt."validado" IS TRUE)::int AS val
                FROM "PAGOS_TITULARES" pt JOIN "PEOPLE" x ON x."_id" = pt."idPeople" GROUP BY x."contrato")
    SELECT
      p."_id" AS "titularId", p."contrato", p."primerNombre", p."primerApellido", p."numeroId",
      p."plataforma", p."aprobacion", p."estado", p."_updatedDate" AS "anuladoEl", p."_createdDate" AS "creado",
      COALESCE(benef.b, 0)   AS "beneficiarios",
      COALESCE(pag.total, 0) AS "pagos",
      COALESCE(pag.val, 0)   AS "pagosValidados",
      COALESCE(comp.docs, 0) AS "docsCompartidos"
    FROM "PEOPLE" p
    LEFT JOIN benef ON benef."contrato" = p."contrato"
    LEFT JOIN pag   ON pag."contrato"   = p."contrato"
    LEFT JOIN comp  ON comp."contrato"  = p."contrato"
    WHERE ${conds.join(' AND ')}
    ORDER BY p."_updatedDate" ASC NULLS FIRST
    LIMIT 1000`, params)

  const plat = await query<{ plataforma: string }>(`
    SELECT DISTINCT p."plataforma" FROM "PEOPLE" p
     WHERE p."tipoUsuario" = 'TITULAR' AND ${ANULADO_WHERE} AND p."plataforma" IS NOT NULL AND TRIM(p."plataforma") <> ''
     ORDER BY 1`)

  const est = await query<{ estado: string }>(`
    SELECT DISTINCT COALESCE(NULLIF(p."aprobacion",''), p."estado") AS estado FROM "PEOPLE" p
     WHERE p."tipoUsuario" = 'TITULAR' AND ${ANULADO_WHERE}
     ORDER BY 1`)

  return successResponse({
    estados: est.rows.map(e => e.estado).filter(Boolean),
    rows: r.rows.map((x: any) => ({
      ...x,
      nombre: [x.primerNombre, x.primerApellido].filter(Boolean).join(' ').trim(),
    })),
    plataformas: plat.rows.map(p => p.plataforma),
    total: r.rowCount || 0,
  })
})
