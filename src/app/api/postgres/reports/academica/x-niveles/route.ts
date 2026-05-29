import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { query } from '@/lib/postgres'
import { InformesPermission } from '@/types/permissions'

/**
 * GET /api/postgres/reports/academica/x-niveles?nivel&startDate&endDate
 *
 * Listado de usuarios ACTIVOS en ACADEMICA por nivel (estadoInactivo IS NOT TRUE).
 * Columnas: nombre, id (numeroId), correo, nivel, step. Conteo total + desglose por nivel.
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

// Orden pedagógico para el dropdown/chips de nivel (los no listados —ESS,
// WELCOME, DONE— van al final). Steps se ordenan numéricamente (0→50).
const NIVEL_ORDER = ['BN1', 'BN2', 'BN3', 'P1', 'P2', 'P3', 'F1', 'F2', 'F3', 'MASTER', 'IELTS', 'B2FIRST', 'TOEFL', 'WELCOME', 'ESS', 'DONE']
const nivelRank = (n: string) => { const i = NIVEL_ORDER.indexOf(n); return i >= 0 ? i : 999 }

// Niveles de examen internacional que SIEMPRE deben ofrecerse en el dropdown/chips
// aunque no tengan usuarios activos (para poder filtrarlos). Step canónico: 47/48/49.
const ALWAYS_SHOW_NIVELES = ['IELTS', 'B2FIRST', 'TOEFL']

// Steps CANÓNICOS del currículo por nivel (no de los datos, que pueden traer
// registros sucios — ej. P2 con "Step 26", que en realidad es de P3).
// Niveles principales = 5 steps consecutivos: BN1=1–5, BN2=6–10, … F3=41–45.
const MAIN_LEVELS = ['BN1', 'BN2', 'BN3', 'P1', 'P2', 'P3', 'F1', 'F2', 'F3']
const SPECIAL_STEPS: Record<string, string[]> = {
  WELCOME: ['WELCOME'], ESS: ['Step 0'],
  MASTER: ['Step 46'], IELTS: ['Step 47'], B2FIRST: ['Step 48'], TOEFL: ['Step 49'], DONE: ['Step 50'],
}
function canonicalSteps(nivel: string): string[] {
  const mi = MAIN_LEVELS.indexOf(nivel)
  if (mi >= 0) { const start = 1 + mi * 5; return Array.from({ length: 5 }, (_, k) => `Step ${start + k}`) }
  return SPECIAL_STEPS[nivel] ?? []
}

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, InformesPermission.ACAD_X_NIVELES)

  const { searchParams } = new URL(req.url)
  const nivelRaw  = (searchParams.get('nivel') || '').trim()
  const nivel     = nivelRaw && nivelRaw.toLowerCase() !== 'todos' ? nivelRaw : null
  const stepRaw   = (searchParams.get('step') || '').trim()
  const step      = stepRaw && stepRaw.toLowerCase() !== 'todos' ? stepRaw : null
  const startDate = searchParams.get('startDate') || null
  const endDate   = searchParams.get('endDate') || null

  // $1 nivel, $2 startDate, $3 endDate, $4 step (todos opcionales)
  // Solo usuarios ACTIVOS: "estadoInactivo" IS NOT TRUE (excluye true; false/NULL = activo).
  const where = `
    "nivel" IS NOT NULL AND TRIM("nivel") <> ''
    AND "estadoInactivo" IS NOT TRUE
    AND ($1::text IS NULL OR "nivel" = $1)
    AND ($2::date IS NULL OR ${CDATE} >= $2::date)
    AND ($3::date IS NULL OR ${CDATE} <= $3::date)
    AND ($4::text IS NULL OR "step" = $4)`
  const params = [nivel, startDate, endDate, step]

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
      AND "estadoInactivo" IS NOT TRUE
      AND ($1::date IS NULL OR ${CDATE} >= $1::date)
      AND ($2::date IS NULL OR ${CDATE} <= $2::date)
    GROUP BY "nivel" ORDER BY n DESC`, [startDate, endDate])

  // Niveles disponibles para el dropdown (orden pedagógico, no alfabético)
  const nivelesRes = await query<{ nivel: string }>(`
    SELECT DISTINCT "nivel" FROM "ACADEMICA"
    WHERE "nivel" IS NOT NULL AND TRIM("nivel") <> '' AND "estadoInactivo" IS NOT TRUE`)
  const niveles = Array.from(new Set([...nivelesRes.rows.map(r => r.nivel), ...ALWAYS_SHOW_NIVELES]))
    .sort((a, b) => nivelRank(a) - nivelRank(b) || a.localeCompare(b))

  // Steps disponibles para el dropdown = los CANÓNICOS del nivel (currículo),
  // no los distinct de ACADEMICA (que incluyen datos sucios). Vacío si 'Todos'.
  const stepsDisponibles = nivel ? canonicalSteps(nivel) : []

  return successResponse({
    rows: rowsRes.rows,
    total,
    capped: total > MAX_ROWS,
    maxRows: MAX_ROWS,
    porNivel: (() => {
      const m = new Map(porNivelRes.rows.map(r => [r.nivel, Number(r.n)]))
      for (const n of ALWAYS_SHOW_NIVELES) if (!m.has(n)) m.set(n, 0)  // siempre presentes, aun con 0
      return Array.from(m, ([nivel, n]) => ({ nivel, n }))
        .sort((a, b) => nivelRank(a.nivel) - nivelRank(b.nivel) || a.nivel.localeCompare(b.nivel))
    })(),
    meta: { niveles, stepsDisponibles, nivel: nivel ?? '', step: step ?? '', startDate: startDate ?? '', endDate: endDate ?? '' },
  })
})
