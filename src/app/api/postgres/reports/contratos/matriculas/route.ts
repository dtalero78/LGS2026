import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { query, queryOne } from '@/lib/postgres'
import { InformesPermission } from '@/types/permissions'

/**
 * GET /api/postgres/reports/contratos/matriculas
 *
 * Informe de Matrículas (snapshot de contratos). Tarjetas + barras + dona + heatmap.
 *
 * Definiciones (sobre PEOPLE.tipoUsuario='TITULAR'):
 *   - x Aprobar  = pendientes de aprobación: aprobacion NULL o 'Pendiente'
 *                  (excluye Rechazado/Devuelto/Retractado/Contrato Nulo, ya decididos)
 *                  y descarta nombres placeholder ('TITULAR'/'BENEFICIARIO') o vacíos.
 *   - Vigentes   = aprobacion IN ('Aprobado','Aprobada') Y estado <> 'FINALIZADA'.
 *   - Finalizados= estado = 'FINALIZADA' (≡ aprobacion='FINALIZADA').
 *   - Beneficiarios = BENEFICIARIO(/A) cuyo titular es Vigente.
 *   - Académicos activos   = ACADEMICA en Step 0–49 (o WELCOME) y no inactivado
 *                            (estadoInactivo!=true — la finalización del titular lo marca).
 *   - Académicos inactivos = ACADEMICA en Step 50 (DONE).
 *
 * Gateado por INFORMES.CONTRATOS.MATRICULAS (SUPER_ADMIN/ADMIN bypass).
 */

const NOMBRE_OK = `(
  UPPER(COALESCE("primerNombre",'')) NOT IN ('TITULAR','BENEFICIARIO','BENEFICIARIA')
  AND UPPER(COALESCE("primerApellido",'')) NOT IN ('TITULAR','BENEFICIARIO','BENEFICIARIA')
  AND TRIM(COALESCE("primerNombre",'')) <> ''
)`
const PENDIENTE = `("aprobacion" IS NULL OR "aprobacion" = 'Pendiente')`
const APROBADO  = `("aprobacion" IN ('Aprobado','Aprobada'))`
const STEP_NUM  = `NULLIF(REGEXP_REPLACE("step",'[^0-9]','','g'),'')`

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  await requirePermission(session, InformesPermission.CONTRATOS_MATRICULAS)

  const year = new Date().getFullYear()
  const num = (r: any) => Number(r?.n) || 0

  const [
    xAprobarR, vigentesR, finalizadosR, beneficiariosR, acadActivosR, acadInactivosR,
  ] = await Promise.all([
    queryOne<{ n: number }>(`SELECT COUNT(*)::int n FROM "PEOPLE" WHERE "tipoUsuario"='TITULAR' AND ${PENDIENTE} AND ${NOMBRE_OK}`),
    queryOne<{ n: number }>(`SELECT COUNT(*)::int n FROM "PEOPLE" WHERE "tipoUsuario"='TITULAR' AND ${APROBADO} AND ("estado" IS DISTINCT FROM 'FINALIZADA')`),
    queryOne<{ n: number }>(`SELECT COUNT(*)::int n FROM "PEOPLE" WHERE "tipoUsuario"='TITULAR' AND "estado"='FINALIZADA'`),
    queryOne<{ n: number }>(`
      SELECT COUNT(*)::int n FROM "PEOPLE" b
      WHERE b."tipoUsuario" IN ('BENEFICIARIO','BENEFICIARIA')
        AND b."titularId" IN (
          SELECT t."_id" FROM "PEOPLE" t
          WHERE t."tipoUsuario"='TITULAR'
            AND (t."aprobacion" IN ('Aprobado','Aprobada'))
            AND (t."estado" IS DISTINCT FROM 'FINALIZADA')
        )`),
    queryOne<{ n: number }>(`
      SELECT COUNT(*)::int n FROM "ACADEMICA"
      WHERE ("estadoInactivo" IS NOT TRUE)
        AND ( ("step" ILIKE 'Step %' AND ${STEP_NUM} IS NOT NULL AND ${STEP_NUM}::int BETWEEN 0 AND 49)
              OR "step" = 'WELCOME' )`),
    queryOne<{ n: number }>(`SELECT COUNT(*)::int n FROM "ACADEMICA" WHERE "step"='Step 50'`),
  ])

  const cards = {
    xAprobar:           num(xAprobarR),
    vigentes:           num(vigentesR),
    finalizados:        num(finalizadosR),
    beneficiarios:      num(beneficiariosR),
    academicosActivos:  num(acadActivosR),
    academicosInactivos:num(acadInactivosR),
  }

  // Barras: matrículas pendientes por antigüedad sin aprobar (desde fecha de
  // contrato / creación). Buckets pedidos: 1 sem–1 mes, 1–2 meses, +2 meses.
  const barRow = await queryOne<{ b1: number; b2: number; b3: number }>(`
    WITH p AS (
      SELECT GREATEST(0, (CURRENT_DATE - COALESCE("fechaContrato", ("_createdDate" AT TIME ZONE 'America/Bogota')::date))) AS dias
      FROM "PEOPLE" WHERE "tipoUsuario"='TITULAR' AND ${PENDIENTE} AND ${NOMBRE_OK}
    )
    SELECT
      COUNT(*) FILTER (WHERE dias >= 7  AND dias < 30)::int  AS b1,
      COUNT(*) FILTER (WHERE dias >= 30 AND dias < 60)::int  AS b2,
      COUNT(*) FILTER (WHERE dias >= 60)::int                AS b3
    FROM p`)
  const barPendientes = [
    { name: '1 sem – 1 mes', value: num({ n: barRow?.b1 }) },
    { name: '1 – 2 meses',   value: num({ n: barRow?.b2 }) },
    { name: '+2 meses',      value: num({ n: barRow?.b3 }) },
  ]

  // Dona: aprobadas sin finalizar (vigentes) vs sin aprobar (pendientes)
  const donut = [
    { name: 'Aprobadas (sin finalizar)', value: cards.vigentes },
    { name: 'Sin aprobar',               value: cards.xAprobar },
  ].filter(d => d.value > 0)

  // Heatmap: matrículas aprobadas del año, por país × mes (mes de inicioContrato/firma)
  const heatRows = await query<{ pais: string; mes: number; n: number }>(`
    SELECT COALESCE(NULLIF(TRIM("plataforma"),''),'Sin país') AS pais,
           EXTRACT(MONTH FROM COALESCE("inicioContrato","fechaContrato"))::int AS mes,
           COUNT(*)::int AS n
    FROM "PEOPLE"
    WHERE "tipoUsuario"='TITULAR'
      AND ("aprobacion" IN ('Aprobado','Aprobada','FINALIZADA'))
      AND COALESCE("inicioContrato","fechaContrato") IS NOT NULL
      AND EXTRACT(YEAR FROM COALESCE("inicioContrato","fechaContrato")) = $1
    GROUP BY 1, 2`, [year])
  const paises = Array.from(new Set(heatRows.rows.map(r => r.pais))).sort()
  const heatmap = {
    year,
    paises,
    data: heatRows.rows.map(r => ({ pais: r.pais, mes: Number(r.mes), n: Number(r.n) })),
  }

  return successResponse({ cards, barPendientes, donut, heatmap })
})
