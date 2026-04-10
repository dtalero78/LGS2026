'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────
interface HoraRow   { hora: number; total: number }
interface DiaRow    { dow: number; total: number }
interface HeatCell  { dow: number; hora: number; total: number }
interface PlatHora  { plataforma: string; hora: number; total: number }

interface HorariosResponse {
  porHora:       HoraRow[]
  porDia:        DiaRow[]
  heatmap:       HeatCell[]
  porPlataforma: PlatHora[]
}

// ── Constants ──────────────────────────────────────────────────────────────
const today       = new Date().toISOString().split('T')[0]
const firstOfYear = `${new Date().getFullYear()}-01-01`

const DIAS_FULL  = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_SHORT = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#84cc16',
]
const platColor = (i: number) => COLORS[i % COLORS.length]

// ── Helpers ────────────────────────────────────────────────────────────────
function barFill(value: number, max: number): string {
  if (max === 0) return '#bfdbfe'
  const r = value / max
  if (r > 0.85) return '#1d4ed8'
  if (r > 0.65) return '#3b82f6'
  if (r > 0.45) return '#60a5fa'
  if (r > 0.25) return '#93c5fd'
  return '#bfdbfe'
}

function heatBg(val: number, max: number): string {
  if (val === 0 || max === 0) return '#f9fafb'
  const alpha = (val / max) * 0.88 + 0.12
  return `rgba(59, 130, 246, ${alpha.toFixed(2)})`
}

function heatFg(val: number, max: number): string {
  if (val === 0 || max === 0) return '#d1d5db'
  return val / max > 0.5 ? '#ffffff' : '#1e3a8a'
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold leading-tight" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Custom Tooltip para BarChart ───────────────────────────────────────────
function HoraTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600 font-bold">{payload[0].value.toLocaleString()} agendamientos</p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function HorariosPage() {
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate]     = useState(today)
  const [data, setData]           = useState<HorariosResponse | null>(null)
  const [loading, setLoading]     = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs  = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/postgres/reports/estadisticas/horarios?${qs}`)
      const json = await res.json()
      if (json.success) setData(json)
    } catch (e) { console.error(e) }
    finally     { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived data ──────────────────────────────────────────────────────
  const horaChart = Array.from({ length: 24 }, (_, h) => {
    const row = data?.porHora.find(r => r.hora === h)
    return { hora: `${h.toString().padStart(2, '0')}:00`, total: row?.total ?? 0 }
  })
  const maxHora = Math.max(...horaChart.map(d => d.total), 1)

  const diaChart = Array.from({ length: 7 }, (_, i) => {
    const dow = i + 1
    const row = data?.porDia.find(r => r.dow === dow)
    return { dia: DIAS_FULL[dow], total: row?.total ?? 0 }
  })
  const maxDia   = Math.max(...diaChart.map(d => d.total), 1)
  const diaTotal = diaChart.reduce((s, d) => s + d.total, 0)

  const heatMax = Math.max(...(data?.heatmap.map(r => r.total) ?? [0]), 1)
  const heatVal = (dow: number, hora: number) =>
    data?.heatmap.find(r => r.dow === dow && r.hora === hora)?.total ?? 0

  const totalAgendamientos = data?.porHora.reduce((s, r) => s + r.total, 0) ?? 0
  const horaPico = [...(data?.porHora ?? [])].sort((a, b) => b.total - a.total)[0]
  const diaPico  = [...(data?.porDia  ?? [])].sort((a, b) => b.total - a.total)[0]

  // Platform totals
  const platTotals: Record<string, number> = {}
  data?.porPlataforma.forEach(r => {
    platTotals[r.plataforma] = (platTotals[r.plataforma] ?? 0) + r.total
  })
  const platSorted  = Object.entries(platTotals).sort((a, b) => b[1] - a[1])
  const grandTotal  = platSorted.reduce((s, [, t]) => s + t, 0)

  // ── CSV export ────────────────────────────────────────────────────────
  const handleCSV = () => {
    type Row = { tipo: string; label: string; valor: number }
    const rows: Row[] = [
      { tipo: 'Filtro', label: 'Fecha inicial', valor: startDate as any },
      { tipo: 'Filtro', label: 'Fecha final',   valor: endDate   as any },
      { tipo: 'Filtro', label: 'Total agendamientos', valor: totalAgendamientos },
    ]
    horaChart.forEach(r => rows.push({ tipo: 'Por Hora', label: r.hora, valor: r.total }))
    diaChart.forEach(r  => rows.push({ tipo: 'Por Día',  label: r.dia,  valor: r.total }))
    platSorted.forEach(([p, t]) => rows.push({ tipo: 'Por País', label: p, valor: t }))
    exportToExcel(rows, [
      { header: 'Tipo',           accessor: r => r.tipo  },
      { header: 'Período / País', accessor: r => r.label },
      { header: 'Agendamientos',  accessor: r => r.valor },
    ], `horarios-agendamiento_${startDate}_${endDate}`)
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Horarios de Agendamiento</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Análisis de cuándo los estudiantes realizan sus reservas · Horario Colombia / Ecuador (UTC-5)
          </p>
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="hor-start" className="block text-xs text-gray-500 mb-1">Fecha inicial</label>
              <input
                id="hor-start" type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="hor-end" className="block text-xs text-gray-500 mb-1">Fecha final</label>
              <input
                id="hor-end" type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => { setStartDate(firstOfYear); setEndDate(today) }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpiar filtros
              </button>
              <button
                type="button" onClick={handleCSV} disabled={loading}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Descargar CSV
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total Agendamientos"
            value={loading ? '—' : totalAgendamientos.toLocaleString()}
            sub="panel + admin (dic 2025–hoy)"
            accent="#3b82f6"
          />
          <KpiCard
            label="Hora Pico"
            value={loading || !horaPico ? '—' : `${horaPico.hora.toString().padStart(2, '0')}:00`}
            sub={horaPico ? `${horaPico.total.toLocaleString()} agendamientos` : undefined}
            accent="#1d4ed8"
          />
          <KpiCard
            label="Día más Activo"
            value={loading || !diaPico ? '—' : DIAS_FULL[diaPico.dow]}
            sub={diaPico ? `${diaPico.total.toLocaleString()} agendamientos` : undefined}
            accent="#7c3aed"
          />
          <KpiCard
            label="País Principal"
            value={loading ? '—' : (platSorted[0]?.[0] ?? '—')}
            sub={platSorted[0] ? `${platSorted[0][1].toLocaleString()} agendamientos` : undefined}
            accent="#059669"
          />
        </div>

        {/* ── Bar chart: distribución por hora ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                Distribución por Hora del Día
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Cantidad de agendamientos por hora (00:00 – 23:00)</p>
            </div>
            {loading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={horaChart} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="hora"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickFormatter={v => v.replace(':00', '')}
                interval={1}
              />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={38} />
              <Tooltip content={<HoraTooltip />} />
              <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {horaChart.map((entry, i) => (
                  <Cell key={i} fill={barFill(entry.total, maxHora)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Pico annotations */}
          {!loading && (
            <div className="mt-3 flex flex-wrap gap-3 justify-center">
              {horaChart
                .filter(d => d.total >= maxHora * 0.85)
                .map(d => (
                  <span key={d.hora} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    {d.hora} · {d.total.toLocaleString()}
                  </span>
                ))
              }
            </div>
          )}
        </div>

        {/* ── 2-col: día semana + plataformas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* By day of week */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">
              Por Día de la Semana
            </h3>
            <p className="text-xs text-gray-400 mb-5">Distribución relativa de agendamientos</p>

            {loading ? (
              <div className="h-52 flex items-center justify-center text-sm text-gray-400 animate-pulse">Cargando...</div>
            ) : (
              <div className="space-y-3">
                {diaChart.map((row, i) => {
                  const pct   = maxDia > 0 ? (row.total / maxDia) * 100 : 0
                  const share = diaTotal > 0 ? ((row.total / diaTotal) * 100).toFixed(1) : '0'
                  const fill  = barFill(row.total, maxDia)
                  return (
                    <div key={row.dia} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-20 text-right flex-shrink-0 font-medium">
                        {row.dia}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                        <div
                          className="h-6 rounded-full flex items-center justify-end pr-2.5 transition-all duration-500"
                          style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: fill }}
                        >
                          {pct > 18 && (
                            <span className="text-white text-xs font-semibold">
                              {row.total.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {pct <= 18 && row.total > 0 && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-700">
                            {row.total.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 w-10 flex-shrink-0 text-right">{share}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Platform breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">
              Por País / Plataforma
            </h3>
            <p className="text-xs text-gray-400 mb-5">Volumen y horas pico por país</p>

            {loading ? (
              <div className="h-52 flex items-center justify-center text-sm text-gray-400 animate-pulse">Cargando...</div>
            ) : (
              <div className="space-y-4">
                {platSorted.slice(0, 6).map(([pais, total], i) => {
                  const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
                  const topHoras = (data?.porPlataforma ?? [])
                    .filter(r => r.plataforma === pais)
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 3)
                    .map(r => `${r.hora.toString().padStart(2, '0')}:00`)
                    .join(' · ')
                  return (
                    <div key={pais}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: platColor(i) }} />
                          <span className="text-sm font-semibold text-gray-700">{pais}</span>
                        </div>
                        <span className="text-sm text-gray-600">
                          {total.toLocaleString()}
                          <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: platColor(i) }}
                        />
                      </div>
                      {topHoras && (
                        <p className="text-xs text-gray-400 mt-1">
                          <span className="font-medium text-gray-500">Horas pico:</span> {topHoras}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Heatmap: hora × día ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                Mapa de Calor — Hora × Día
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Intensidad de agendamientos por franja horaria y día de la semana
              </p>
            </div>
            {loading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
          </div>

          {!loading && (
            <div className="overflow-x-auto">
              <table className="text-xs" style={{ borderSpacing: 3, borderCollapse: 'separate' }}>
                <thead>
                  <tr>
                    <th className="text-right text-gray-400 font-normal pr-3 pb-2 w-12" />
                    {Array.from({ length: 24 }, (_, h) => (
                      <th
                        key={h}
                        className="text-center text-gray-400 font-normal pb-2"
                        style={{ width: 30, minWidth: 30 }}
                      >
                        {h.toString().padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }, (_, i) => {
                    const dow = i + 1
                    return (
                      <tr key={dow}>
                        <td className="text-right text-gray-600 font-semibold pr-3 py-0.5 text-xs">
                          {DIAS_SHORT[dow]}
                        </td>
                        {Array.from({ length: 24 }, (_, h) => {
                          const val = heatVal(dow, h)
                          return (
                            <td
                              key={h}
                              className="text-center rounded py-0.5"
                              title={`${DIAS_FULL[dow]} ${h.toString().padStart(2, '0')}:00 — ${val.toLocaleString()} agendamientos`}
                              style={{
                                backgroundColor: heatBg(val, heatMax),
                                color:           heatFg(val, heatMax),
                                width: 30, height: 26,
                                fontSize: 9, fontWeight: val > 0 ? 600 : 400,
                                cursor: val > 0 ? 'default' : 'default',
                              }}
                            >
                              {val > 0 ? val.toLocaleString() : ''}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-2 justify-end">
                <span className="text-xs text-gray-400">Menor actividad</span>
                {[0.12, 0.28, 0.45, 0.62, 0.78, 1.0].map((alpha, i) => (
                  <div
                    key={i}
                    className="rounded"
                    style={{
                      width: 22, height: 16,
                      backgroundColor: `rgba(59, 130, 246, ${alpha})`,
                    }}
                  />
                ))}
                <span className="text-xs text-gray-400">Mayor actividad</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Nota metodológica ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
          <span className="font-semibold">Nota metodológica:</span> El análisis incluye únicamente
          agendamientos realizados desde el panel del estudiante (<code className="bg-blue-100 px-1 rounded">PANEL_EST</code>),
          el panel administrativo (<code className="bg-blue-100 px-1 rounded">POSTGRES</code>) y
          actividades complementarias (<code className="bg-blue-100 px-1 rounded">COMP</code>).
          Los registros migrados de Wix no tienen fecha de agendamiento confiable y se excluyen.
          Se excluyen también sesiones de tipo <code className="bg-blue-100 px-1 rounded">COMPLEMENTARIA</code> y
          nivel <code className="bg-blue-100 px-1 rounded">WELCOME</code>.
          Todos los horarios están en zona horaria Colombia / Ecuador (UTC-5).
        </div>

      </div>
    </DashboardLayout>
  )
}
