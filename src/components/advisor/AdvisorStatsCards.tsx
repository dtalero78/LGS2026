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
  asistieron?: number
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

// ── Variante "Control de Horas" ────────────────────────────────────────────
// Mismas cajas que la página Control de Horas: 4 grandes (incluye Total Hours)
// + 7 detalle (incluye Without Assistants, sin Training). Total Hours descuenta
// media hora por sesión conducida sin asistentes, SALVO advisor de planta.

export interface ControlHorasKpis {
  sessions: number; clubs: number; welcome: number
  conducted: number; sinAsistentes: number; canceled: number; suspended: number
  effective: number; sinRegistrar: number; administrative: number; totalHours: number
}

/**
 * KPIs estilo Control de Horas. IDÉNTICO al `totales` de la página Control de
 * Horas: agrupa compartidos por `eventoCompartidoId` (any closed → Effective),
 * acumula `asistieron` entre hermanos, cuenta "sin asistentes" sólo si el grupo
 * NO es compartido y tuvo 0 asistentes, y Total Hours = Effective − (sin
 * asistentes × 0.5) salvo `esPlanta`.
 */
export function computeControlHorasKpis(
  data: { vigentes: VigenteRow[]; historicos: HistoricoRow[] } | null,
  adminAgg: { registradas: number; sinRegistrar: number },
  esPlanta: boolean,
): ControlHorasKpis {
  const t: ControlHorasKpis = {
    sessions: 0, clubs: 0, welcome: 0,
    conducted: 0, sinAsistentes: 0, canceled: 0, suspended: 0,
    effective: 0, sinRegistrar: 0, administrative: 0, totalHours: 0,
  }
  if (!data) return t

  const nowMs = Date.now()
  const isPast = (iso: string | null | undefined) => iso != null && new Date(iso).getTime() <= nowMs
  const countByTipo = (tipo: string | null) => {
    switch ((tipo || '').toUpperCase()) {
      case 'SESSION': t.sessions++; break
      case 'CLUB':    t.clubs++; break
      case 'WELCOME': t.welcome++; break
    }
  }

  type GroupState = { tipo: string | null; sesionCerrada: boolean; asistieron: number; compartido: boolean }
  const groups = new Map<string, GroupState>()
  data.vigentes.forEach(v => {
    if (!isPast(v.fechaEvento)) return
    const key = v.eventoCompartidoId || v.eventoId
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { tipo: v.tipo, sesionCerrada: v.sesionCerrada === true, asistieron: v.asistieron || 0, compartido: !!v.eventoCompartidoId })
    } else {
      if (v.sesionCerrada === true) existing.sesionCerrada = true
      existing.asistieron += (v.asistieron || 0)
    }
  })
  for (const g of groups.values()) {
    countByTipo(g.tipo)
    t.conducted++
    if (g.asistieron === 0 && !g.compartido) t.sinAsistentes++
    if (g.sesionCerrada) t.effective++
    else                 t.sinRegistrar++
  }
  data.historicos.forEach(h => {
    if (!isPast(h.fechaEvento)) return
    countByTipo(h.tipo)
    if (h.estado === 'Canceled')  t.canceled++
    if (h.estado === 'Suspended') t.suspended++
  })
  t.effective      += adminAgg.registradas
  t.sinRegistrar   += adminAgg.sinRegistrar
  t.administrative  = adminAgg.registradas + adminAgg.sinRegistrar
  t.totalHours = t.effective - (esPlanta ? 0 : t.sinAsistentes * 0.5)
  return t
}

/** Las cajas de Control de Horas + casilla Advisor Planta (solo lectura). */
export function ControlHorasKpiCards({ kpis, esPlanta }: { kpis: ControlHorasKpis; esPlanta: boolean }) {
  return (
    <div className="space-y-3">
      {/* Advisor Planta — solo lectura (refleja ADVISORS.esPlanta, no editable) */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-2 select-none whitespace-nowrap opacity-90">
          <span className="text-sm font-medium text-gray-700">Advisor Planta</span>
          <input type="checkbox" checked={esPlanta} disabled readOnly aria-label="Advisor Planta (solo lectura)"
            className="h-4 w-4 rounded border-gray-300 text-slate-600 cursor-not-allowed" />
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <KpiCard label="Effective Hours"         value={kpis.effective}     color="bg-emerald-50 border-emerald-400 text-emerald-700" big />
        <KpiCard label="Hours without recording" value={kpis.sinRegistrar}   color="bg-amber-50   border-amber-400   text-amber-700"   big />
        <KpiCard label="Administrative Hours"    value={kpis.administrative} color="bg-violet-50  border-violet-400  text-violet-700"  big />
        <KpiCard label="Total Hours"             value={kpis.totalHours}    color="bg-slate-100  border-slate-400   text-slate-700"   big />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
        <KpiCard label="Sessions"           value={kpis.sessions}     color="bg-blue-50   border-blue-300   text-blue-700" />
        <KpiCard label="Clubs"              value={kpis.clubs}        color="bg-green-50  border-green-300  text-green-700" />
        <KpiCard label="Welcome"            value={kpis.welcome}      color="bg-purple-50 border-purple-300 text-purple-700" />
        <KpiCard label="Conducted"          value={kpis.conducted}    color="bg-sky-50    border-sky-300    text-sky-700" />
        <KpiCard label="Without Assistants" value={kpis.sinAsistentes} color="bg-orange-50 border-orange-300 text-orange-700" />
        <KpiCard label="Canceled"           value={kpis.canceled}     color="bg-red-50    border-red-300    text-red-700" />
        <KpiCard label="Suspended"          value={kpis.suspended}    color="bg-yellow-50 border-yellow-300 text-yellow-800" />
      </div>
    </div>
  )
}

/**
 * Self-contained: cajas de Control de Horas para páginas del advisor (dashboard
 * `/` y `/panel-advisor`). Hace el fetch de control-horas + admin-events y
 * renderiza `ControlHorasKpiCards`. `esPlanta` (solo lectura) lo pasa el caller
 * desde el advisor resuelto (ADVISORS.esPlanta).
 */
export function AdvisorHoursCards({ advisorId, year, month, esPlanta }: {
  advisorId: string; year: number; month: number; esPlanta: boolean
}) {
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
      .catch(() => { /* silencioso */ })
      .finally(() => setLoading(false))
  }, [advisorId, year, month])

  const kpis = useMemo(() => computeControlHorasKpis(data, adminAgg, esPlanta), [data, adminAgg, esPlanta])

  if (loading && !data) {
    return <div className="text-sm text-gray-400 py-2">Cargando estadísticas del mes…</div>
  }
  return <ControlHorasKpiCards kpis={kpis} esPlanta={esPlanta} />
}
