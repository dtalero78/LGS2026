'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'

interface Sesiones {
  total: number
  asistieron: number
  noAsistieron: number
  cancelaron: number
}
interface ReportData {
  sesiones: Sesiones
  plataformas: string[]
}

const today       = new Date().toISOString().split('T')[0]
const firstOfYear = `${new Date().getFullYear()}-01-01`

function DonutChart({ segments }: {
  segments: { label: string; value: number; color: string }[]
}) {
  const total = segments.reduce((s, d) => s + d.value, 0)
  const r = 55, cx = 70, cy = 70, sw = 22
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
        ) : (
          segments.map((seg, i) => {
            const pct = seg.value / total
            const dash = pct * circ
            const gap = circ - dash
            const rot = offset * 360 - 90
            offset += pct
            return (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={sw}
                strokeDasharray={`${dash} ${gap}`}
                strokeLinecap="butt"
                transform={`rotate(${rot} ${cx} ${cy})`}
              />
            )
          })
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#6b7280">TOTAL</text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-600 w-28">{seg.label}</span>
            <span className="font-semibold text-gray-900">{seg.value.toLocaleString()}</span>
            <span className="text-gray-400 text-xs">
              {total > 0 ? `${((seg.value / total) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{value.toLocaleString()}</span>
    </div>
  )
}

export default function InformeWelcomeSessionPage() {
  const [startDate, setStartDate]   = useState(firstOfYear)
  const [endDate, setEndDate]       = useState(today)
  const [plataforma, setPlataforma] = useState('')
  const [data, setData]             = useState<ReportData | null>(null)
  const [loading, setLoading]       = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate, plataforma })
      const res = await fetch(`/api/postgres/reports/asistencia/welcome?${qs}`)
      const json = await res.json()
      if (json.success) setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, plataforma])

  useEffect(() => { fetchData() }, [fetchData])

  const clearFilters = () => {
    setStartDate(firstOfYear)
    setEndDate(today)
    setPlataforma('')
  }

  const s = data?.sesiones ?? { total: 0, asistieron: 0, noAsistieron: 0, cancelaron: 0 }

  const segments = [
    { label: 'Asistieron',    value: s.asistieron,   color: '#3b82f6' },
    { label: 'No asistieron', value: s.noAsistieron, color: '#f59e0b' },
    { label: 'Cancelaron',    value: s.cancelaron,   color: '#ef4444' },
  ]

  const handleDownloadCSV = () => {
    const rows = [
      { seccion: 'Filtros',          categoria: 'Fecha inicial',   cantidad: startDate,             porcentaje: '' },
      { seccion: 'Filtros',          categoria: 'Fecha final',      cantidad: endDate,               porcentaje: '' },
      { seccion: 'Filtros',          categoria: 'Plataforma',       cantidad: plataforma || 'Todas', porcentaje: '' },
      { seccion: 'Welcome Sessions', categoria: 'Total',            cantidad: s.total,               porcentaje: '' },
      { seccion: 'Welcome Sessions', categoria: 'Asistieron',       cantidad: s.asistieron,          porcentaje: s.total > 0 ? `${((s.asistieron / s.total) * 100).toFixed(1)}%` : '0%' },
      { seccion: 'Welcome Sessions', categoria: 'No asistieron',    cantidad: s.noAsistieron,        porcentaje: s.total > 0 ? `${((s.noAsistieron / s.total) * 100).toFixed(1)}%` : '0%' },
      { seccion: 'Welcome Sessions', categoria: 'Cancelaron',       cantidad: s.cancelaron,          porcentaje: s.total > 0 ? `${((s.cancelaron / s.total) * 100).toFixed(1)}%` : '0%' },
    ]
    exportToExcel(rows, [
      { header: 'Sección',    accessor: r => r.seccion },
      { header: 'Categoría',  accessor: r => r.categoria },
      { header: 'Cantidad',   accessor: r => r.cantidad },
      { header: 'Porcentaje', accessor: r => r.porcentaje },
    ], `informe-welcome-session_${startDate}_${endDate}`)
  }

  return (
    <DashboardLayout>
      <div className="flex gap-5 min-h-screen">

        {/* ── Left Panel ── */}
        <aside className="w-60 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-4">
            <h2 className="text-base font-bold text-gray-900 mb-1">Informe Welcome Session</h2>
            <p className="text-xs text-gray-400 mb-5">
              {startDate} → {endDate}
              {plataforma && <span className="block">{plataforma}</span>}
            </p>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sesiones</p>
            <StatRow label="Total"         value={s.total}        color="#6b7280" />
            <StatRow label="Asistieron"    value={s.asistieron}   color="#3b82f6" />
            <StatRow label="No asistieron" value={s.noAsistieron} color="#f59e0b" />
            <StatRow label="Cancelaron"    value={s.cancelaron}   color="#ef4444" />
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 space-y-5">

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="ws-start" className="block text-xs text-gray-500 mb-1">Fecha inicial</label>
                <input id="ws-start" type="date" value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="ws-end" className="block text-xs text-gray-500 mb-1">Fecha final</label>
                <input id="ws-end" type="date" value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="ws-plat" className="block text-xs text-gray-500 mb-1">Plataforma</label>
                <select id="ws-plat" value={plataforma} onChange={e => setPlataforma(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todas</option>
                  {(data?.plataformas ?? []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={clearFilters}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Limpiar filtros
                </button>
                <button type="button" onClick={handleDownloadCSV}
                  disabled={loading}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Descargar CSV
                </button>
              </div>
            </div>
          </div>

          {/* WELCOME SESSIONS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Welcome Sessions</h3>
                <p className="text-xs text-gray-400 mt-0.5">Sesiones de bienvenida (Nivel WELCOME)</p>
              </div>
              {loading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
            </div>
            <DonutChart segments={segments} />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {segments.map(seg => (
                <div key={seg.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: seg.color + '15' }}>
                  <p className="text-2xl font-bold" style={{ color: seg.color }}>{seg.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{seg.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 text-sm">
              <span className="text-gray-500">Total programadas:</span>
              <span className="font-bold text-gray-900 text-lg">{s.total.toLocaleString()}</span>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
