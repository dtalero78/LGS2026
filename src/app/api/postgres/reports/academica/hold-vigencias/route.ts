import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { query } from '@/lib/postgres'
import { getLastRun, isStale } from '@/lib/cron-runs'
import { InformesPermission } from '@/types/permissions'

/**
 * GET /api/postgres/reports/academica/hold-vigencias?startDate&endDate
 *
 * Monitoreo de los crons automáticos:
 *   - reconcile-pegados (02:00 UTC): reconcilia "usuarios pegados" limpios
 *     (sin overrides ni clrHistoric) alineando ACADEMICA.step al step real
 *     calculado desde bookings.
 *   - reactivate-onhold (03:00 UTC): desbloquea estudiantes con OnHold vencido.
 *   - expire-contracts  (04:00 UTC): bloquea contratos vencidos (FINALIZADA).
 *
 * Muestra: salud de cada cron (CRON_RUNS), acciones recientes (desbloqueos /
 * bloqueos / reconciliaciones del rango) e INCONSISTENCIAS actuales =
 * registros que cumplen la condición pero NO fueron procesados, con la
 * causa inferida.
 *
 * Gateado por INFORMES.ACADEMICA.HOLD_VIGENCIAS (SUPER_ADMIN/ADMIN bypass).
 */

interface CronDetail { studentId: string; nombre: string; success: boolean; error?: string; diasExtendidos?: number; finalContrato?: string; stepAnterior?: number; stepNuevo?: number; nivel?: string; numeroId?: string }

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, InformesPermission.ACAD_HOLD_VIGENCIAS)

  const { searchParams } = new URL(req.url)
  const end   = searchParams.get('endDate')   || new Date().toISOString().substring(0, 10)
  const start = searchParams.get('startDate') || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().substring(0, 10) })()

  // ── Salud de los crons (última corrida) ──
  const [reactLast, expireLast, reconLast] = await Promise.all([
    getLastRun('reactivate-onhold'),
    getLastRun('expire-contracts'),
    getLastRun('reconcile-pegados'),
  ])
  const summarize = (run: any) => {
    if (!run) return { lastRun: null, status: null, hoursSince: null, stale: true, processed: 0, success: 0, failed: 0, error: null }
    const fin = run.finishedAt ? new Date(run.finishedAt) : null
    const hrs = fin ? +((Date.now() - fin.getTime()) / 3_600_000).toFixed(1) : null
    return {
      lastRun: fin?.toISOString() ?? null, status: run.status, hoursSince: hrs, stale: isStale(run),
      processed: run.processedCount ?? 0, success: run.successCount ?? 0, failed: run.failedCount ?? 0,
      error: run.errorMessage ?? null,
    }
  }
  const crons = {
    reactivate: summarize(reactLast),
    expire:     summarize(expireLast),
    reconcile:  summarize(reconLast),
  }

  // Mapa studentId -> error de la última corrida fallida (para inferir causa)
  const failMap = (run: any) => {
    const m = new Map<string, string>()
    for (const d of (run?.metadata?.details ?? []) as CronDetail[]) if (!d.success) m.set(d.studentId, d.error || 'Error desconocido')
    return m
  }
  const reactFails = failMap(reactLast)
  const expireFails = failMap(expireLast)
  const reactLastDate = reactLast?.finishedAt ? new Date(reactLast.finishedAt).toISOString().substring(0, 10) : null
  const expireLastDate = expireLast?.finishedAt ? new Date(expireLast.finishedAt).toISOString().substring(0, 10) : null

  // ── Acciones recientes (rango): aplanar metadata.details de CRON_RUNS ──
  const runsRange = await query<any>(`
    SELECT "cronName", "startedAt", "metadata"
    FROM "CRON_RUNS"
    WHERE "cronName" IN ('reactivate-onhold','expire-contracts','reconcile-pegados')
      AND "startedAt" >= $1::date AND "startedAt" < ($2::date + interval '1 day')
    ORDER BY "startedAt" DESC`, [start, end]).catch(() => ({ rows: [] }))
  const desbloqueos: any[] = []
  const bloqueos: any[] = []
  const reconciliaciones: any[] = []
  for (const r of runsRange.rows) {
    const fecha = new Date(r.startedAt).toISOString().substring(0, 10)
    const details: CronDetail[] = r.metadata?.details ?? []
    for (const d of details) {
      const row = { fecha, nombre: d.nombre, studentId: d.studentId, success: d.success, error: d.error }
      if (r.cronName === 'reactivate-onhold') desbloqueos.push({ ...row, diasExtendidos: d.diasExtendidos })
      else if (r.cronName === 'expire-contracts') bloqueos.push({ ...row, finalContrato: d.finalContrato })
      else /* reconcile-pegados */ reconciliaciones.push({
        ...row, numeroId: d.numeroId, nivel: d.nivel,
        stepAnterior: d.stepAnterior, stepNuevo: d.stepNuevo,
      })
    }
  }

  // ── Inconsistencias AHORA (mismas condiciones que usan los crons) ──
  const holdRows = await query<any>(`
    SELECT "_id", TRIM(CONCAT("primerNombre",' ',"primerApellido")) AS nombre, "numeroId", "plataforma",
           "fechaOnHold"::date AS "fechaOnHold", "fechaFinOnHold"::date AS "fechaFinOnHold",
           (CURRENT_DATE - "fechaFinOnHold"::date) AS "diasVencido"
    FROM "PEOPLE"
    WHERE "estadoInactivo" = true AND "fechaFinOnHold" IS NOT NULL AND "fechaFinOnHold"::date <= CURRENT_DATE
    ORDER BY "fechaFinOnHold" ASC`)
  const vigRows = await query<any>(`
    SELECT "_id", TRIM(CONCAT("primerNombre",' ',"primerApellido")) AS nombre, "numeroId", "plataforma", "contrato",
           "finalContrato"::date AS "finalContrato",
           (CURRENT_DATE - "finalContrato"::date) AS "diasVencido"
    FROM "PEOPLE"
    WHERE "tipoUsuario" = 'BENEFICIARIO' AND "estadoInactivo" = false
      AND "finalContrato" IS NOT NULL AND "finalContrato" < (CURRENT_DATE - INTERVAL '1 day')
      AND ("estado" IS NULL OR "estado" != 'FINALIZADA')
    ORDER BY "finalContrato" ASC`)

  const ymd = (v: any) => (v ? new Date(v).toISOString().substring(0, 10) : null)
  const causaHold = (r: any): string => {
    if (reactFails.has(r._id)) return `Cron falló: ${reactFails.get(r._id)}`
    if (crons.reactivate.stale) return 'El cron no se ha ejecutado en >26h (revisar cron-worker en DO)'
    if (reactLastDate && ymd(r.fechaFinOnHold)! > reactLastDate) return 'Pendiente para la próxima ejecución (venció después de la última corrida)'
    return '⚠ Inconsistencia: cumple la condición pero el cron no lo procesó'
  }
  const causaVig = (r: any): string => {
    if (expireFails.has(r._id)) return `Cron falló: ${expireFails.get(r._id)}`
    if (crons.expire.stale) return 'El cron no se ha ejecutado en >26h (revisar cron-worker en DO)'
    // expirado ⇔ finalContrato < hoy-1; el cron debió tomarlo si venció antes de su última corrida
    if (expireLastDate && ymd(r.finalContrato)! >= expireLastDate) return 'Pendiente para la próxima ejecución (venció después de la última corrida)'
    return '⚠ Inconsistencia: cumple la condición pero el cron no lo procesó'
  }

  // ── Inconsistencia del cron de pegados: casos LIMPIOS aún pegados ──
  // Reutilizo findPegados; uso force=false para tomar el caché de 30 min y no
  // recalcular en cada vista. Los con flags (overrides/clrHistoric) no entran
  // a este conteo — son decisión manual.
  const { findPegados } = await import('@/services/usuarios-pegados.service')
  let pegadosLimpios: any[] = []
  let pegadosConFlags = 0
  try {
    const pegados = await findPegados()
    const limpios = pegados.rows.filter(r => !r.clrHistoric && r.overridesCount === 0)
    pegadosConFlags = pegados.rows.length - limpios.length
    const reconLastDate = reconLast?.finishedAt ? new Date(reconLast.finishedAt).toISOString().substring(0, 10) : null
    const causaPeg = (): string => {
      if (crons.reconcile.stale) return 'El cron no se ha ejecutado en >26h (revisar cron-worker en DO)'
      if (!reconLastDate) return 'El cron aún no ha corrido por primera vez'
      // Si el cron corrió pero hay pegados limpios, puede ser que emergieron HOY (luego del cron)
      return 'Pendiente para la próxima ejecución (emergió tras la última corrida)'
    }
    pegadosLimpios = limpios.map(r => ({
      _id: r.academicaId, nombre: r.nombre, numeroId: r.numeroId, plataforma: r.plataforma,
      contrato: r.contrato, nivel: r.nivel,
      stepActual: r.stepActual, stepReal: r.stepReal, desfase: r.desfase,
      causa: causaPeg(),
    }))
  } catch (e: any) {
    // si findPegados falla por algo, dejamos la sección vacía y NO rompemos el resto
    console.warn('[hold-vigencias] findPegados falló:', e?.message)
  }

  const inconsistencias = {
    holdPendientes: holdRows.rows.map(r => ({
      _id: r._id, nombre: r.nombre, numeroId: r.numeroId, plataforma: r.plataforma,
      fechaOnHold: ymd(r.fechaOnHold), fechaFinOnHold: ymd(r.fechaFinOnHold),
      diasVencido: Number(r.diasVencido) || 0, causa: causaHold(r),
    })),
    vigenciaPendientes: vigRows.rows.map(r => ({
      _id: r._id, nombre: r.nombre, numeroId: r.numeroId, plataforma: r.plataforma, contrato: r.contrato,
      finalContrato: ymd(r.finalContrato), diasVencido: Number(r.diasVencido) || 0, causa: causaVig(r),
    })),
    pegadosLimpios,
    pegadosConFlags,  // los con overrides/clrHistoric — informativo, no son inconsistencia
  }

  return successResponse({
    crons,
    rango: { startDate: start, endDate: end },
    desbloqueos, bloqueos, reconciliaciones,
    totalesRango: {
      desbloqueosOk: desbloqueos.filter(d => d.success).length,
      desbloqueosFail: desbloqueos.filter(d => !d.success).length,
      bloqueosOk: bloqueos.filter(d => d.success).length,
      bloqueosFail: bloqueos.filter(d => !d.success).length,
      reconciliacionesOk: reconciliaciones.filter(d => d.success).length,
      reconciliacionesFail: reconciliaciones.filter(d => !d.success).length,
    },
    inconsistencias,
  })
})
