'use client'

/**
 * Cajas de estadísticas del advisor (mismas del AdvisorDashboard / Control de
 * Horas), reutilizables en cualquier página que tenga el advisorId + mes.
 *
 * Exporta:
 *   - computeAdvisorKpis(data, adminAgg): lógica pura de los KPIs del mes.
 *   - AdvisorKpiCards({ kpis }): las 3 cajas grandes + 7 detalle (presentacional).
 *   - AdvisorStatsCards({ advisorId, year, month }): self-contained — hace el
 *     fetch de control-horas + admin-events y renderiza las cajas.
 *
 * Regla clave (igual que AdvisorDashboard): KPIs sólo cuentan eventos PASADOS;
 * eventos compartidos se agrupan por `eventoCompartidoId` con "any closed →
 * Effective"; los admin registrados suman a Effective, los sin registrar a
 * Hours without recording, y Administrative = total del mes.
 */

import { useEffect, useMemo, useState } from 'react'

export interface VigenteRow {
  source: 'CALENDARIO'
  eventoId: string
  fechaEvento: string
  tipo: string | null
  nivel: string | null
  step: string | null
  sesionCerrada: boolean
  eventoCompartidoId: string | null
}

export interface HistoricoRow {
  source: 'LOG'
  logId: string
  eventoId: string
  fechaEvento: string
  tipo: string | null
  nivel: string | null
  step: string | null
  estado: 'Canceled' | 'Suspended'
}

export interface AdvisorKpis {
  sessions: number; training: number; clubs: number; welcome: number
  conducted: number; canceled: number; suspended: number
  effective: number; sinRegistrar: number; administrative: number
}

/** Un step de CLUB es Training sólo si su nombre empieza con "TRAINING -". */
export function isTrainingStep(step: string | null): boolean {
  return !!step && step.trim().toUpperCase().startsWith('TRAINING -')
}

/** Deriva los KPIs del mes desde el payload de control-horas + agregado admin. */
export function computeAdvisorKpis(
  data: { vigentes: VigenteRow[]; historicos: HistoricoRow[] } | null,
  adminAgg: { registradas: number; sinRegistrar: number },
): AdvisorKpis {
  const k: AdvisorKpis = {
    sessions: 0, training: 0, clubs: 0, welcome: 0,
    conducted: 0, canceled: 0, suspended: 0,
    effective: 0, sinRegistrar: 0, administrative: 0,
  }
  if (!data) return k

  const countTipoStep = (tipo: string | null, step: string | null) => {
    const t = (tipo || '').toUpperCase()
    if (t === 'SESSION')      k.sessions++
    else if (t === 'CLUB')    isTrainingStep(step) ? k.training++ : k.clubs++
    else if (t === 'WELCOME') k.welcome++
  }

  const nowMs = Date.now()
  const isPast = (iso: string | null | undefined) => iso != null && new Date(iso).getTime() <= nowMs

  const groups = new Map<string, { tipo: string | null; step: string | null; sesionCerrada: boolean }>()
  data.vigentes.forEach(v => {
    if (!isPast(v.fechaEvento)) return
    const key = v.eventoCompartidoId || v.eventoId
    const ex = groups.get(key)
    if (!ex) groups.set(key, { tipo: v.tipo, step: v.step, sesionCerrada: v.sesionCerrada === true })
    else if (v.sesionCerrada === true) ex.sesionCerrada = true
  })
  for (const g of groups.values()) {
    countTipoStep(g.tipo, g.step)
    k.conducted++
    if (g.sesionCerrada) k.effective++
    else                 k.sinRegistrar++
  }
  data.historicos.forEach(h => {
    if (!isPast(h.fechaEvento)) return
    countTipoStep(h.tipo, h.step)
    if (h.estado === 'Canceled')  k.canceled++
    if (h.estado === 'Suspended') k.suspended++
  })
  k.effective     += adminAgg.registradas
  k.sinRegistrar  += adminAgg.sinRegistrar
  k.administrative = adminAgg.registradas + adminAgg.sinRegistrar
  return k
}

export function KpiCard({ label, value, color, big }: { label: string; value: number; color: string; big?: boolean }) {
  return (
    <div className={`${color} ${big ? 'border-2' : 'border'} rounded-lg px-3 py-2 text-center`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className={big ? 'text-xs uppercase tracking-wide font-semibold' : 'text-[10px] uppercase tracking-wide font-semibold'}>{label}</div>
    </div>
  )
}

/** Las cajas: 3 grandes (Effective / Sin registrar / Administrative) + 7 detalle. */
export function AdvisorKpiCards({ kpis }: { kpis: AdvisorKpis }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Effective Hours"          value={kpis.effective}    color="bg-emerald-50 border-emerald-400 text-emerald-700" big />
        <KpiCard label="Hours without recording"  value={kpis.sinRegistrar} color="bg-amber-50   border-amber-400   text-amber-700"   big />
        <KpiCard label="Administrative Hours"      value={kpis.administrative} color="bg-violet-50 border-violet-400 text-violet-700" big />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <KpiCard label="Sessions"  value={kpis.sessions}  color="bg-blue-50    border-blue-300    text-blue-700" />
        <KpiCard label="Training"  value={kpis.training}  color="bg-orange-50  border-orange-300  text-orange-700" />
        <KpiCard label="Clubs"     value={kpis.clubs}     color="bg-green-50   border-green-300   text-green-700" />
        <KpiCard label="Welcome"   value={kpis.welcome}   color="bg-purple-50  border-purple-300  text-purple-700" />
        <KpiCard label="Conducted" value={kpis.conducted} color="bg-sky-50     border-sky-300     text-sky-700" />
        <KpiCard label="Canceled"  value={kpis.canceled}  color="bg-red-50     border-red-300     text-red-700" />
        <KpiCard label="Suspended" value={kpis.suspended} color="bg-yellow-50  border-yellow-300  text-yellow-800" />
      </div>
    </div>
  )
}

/**
 * Self-contained: para páginas que NO tienen ya el payload de control-horas
 * (ej. /panel-advisor). Hace el fetch de control-horas + admin-events del mes
 * y renderiza las cajas. Cero backend nuevo.
 */
export function AdvisorStatsCards({ advisorId, year, month }: { advisorId: string; year: number; month: number }) {
  const [data, setData] = useState<{ vigentes: VigenteRow[]; historicos: HistoricoRow[] } | null>(null)
  const [adminAgg, setAdminAgg] = useState<{ registradas: number; sinRegistrar: number }>({ registradas: 0, sinRegistrar: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!advisorId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/postgres/advisors/${advisorId}/control-horas?year=${year}&month=${month}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/postgres/advisors/${advisorId}/admin-events?year=${year}&month=${month}`, { cache: 'no-store' }).then(r => r.json()),
    ])
      .then(([j1, j2]) => {
        if (j1?.success) setData({ vigentes: j1.vigentes ?? [], historicos: j1.historicos ?? [] })
        if (j2?.success) setAdminAgg(j2.aggregate || { registradas: 0, sinRegistrar: 0 })
      })
      .catch(() => { /* silencioso — muestra ceros */ })
      .finally(() => setLoading(false))
  }, [advisorId, year, month])

  const kpis = useMemo(() => computeAdvisorKpis(data, adminAgg), [data, adminAgg])

  if (loading && !data) {
    return <div className="text-sm text-gray-400 py-2">Cargando estadísticas del mes…</div>
  }
  return <AdvisorKpiCards kpis={kpis} />
}
