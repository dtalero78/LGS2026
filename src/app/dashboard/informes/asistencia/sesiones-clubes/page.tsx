'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'

// ── Types ──────────────────────────────────────────────────────────────
interface SesionesData {
  total: number; asistieron: number; noAsistieron: number; cancelaron: number
}
interface JumpsData {
  total: number; asistieron: number; cancelaron: number; aprobaron: number; noAprobaron: number
}
interface PlatRow { plataforma: string; total: number; asistieron: number; cancelaron: number }
interface SesResponse {
  sesiones: SesionesData; plataformas: string[]; niveles: string[]
  sesPorPlataforma: PlatRow[]; jmpPorPlataforma: PlatRow[]
}
interface JmpResponse {
  jumps: JumpsData; plataformas: string[]; niveles: string[]
  porPlataforma: PlatRow[]
}

const today       = new Date().toISOString().split('T')[0]
const firstOfYear = `${new Date().getFullYear()}-01-01`

// ── Donut Chart ────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0)
  const r = 55, cx = 70, cy = 70, sw = 22
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {total === 0
          ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
          : segments.map((seg, i) => {
              const pct = seg.value / total
              const dash = pct * circ
              const gap = circ - dash
              const rot = offset * 360 - 90
              offset += pct
              return <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={sw}
                strokeDasharray={`${dash} ${gap}`} strokeLinecap="butt"
                transform={`rotate(${rot} ${cx} ${cy})`} />
            })
        }
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#6b7280">TOTAL</text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-600 w-28">{seg.label}</span>
            <span className="font-semibold text-gray-900">{seg.value.toLocaleString()}</span>
            <span className="text-gray-400 text-xs">{total > 0 ? `${((seg.value / total) * 100).toFixed(1)}%` : '0%'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Platform Table ─────────────────────────────────────────────────────
function PlatTable({ data }: { data: PlatRow[] }) {
  if (data.length === 0) return null
  return (
    <div className="border-l border-gray-100 pl-5 flex-shrink-0 w-52">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Por plataforma</p>
      <p className="text-xs text-gray-300 mb-3">Solo varía con filtro de fecha</p>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left font-medium pb-1.5">País</th>
            <th className="text-right font-medium pb-1.5">Total</th>
            <th className="text-right font-medium pb-1.5 text-blue-400">Asist.</th>
            <th className="text-right font-medium pb-1.5">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.plataforma} className="border-b border-gray-50 text-xs last:border-0">
              <td className="py-1.5 text-gray-700 font-medium">{row.plataforma}</td>
              <td className="py-1.5 text-right text-gray-500">{row.total.toLocaleString()}</td>
              <td className="py-1.5 text-right text-blue-600 font-semibold">{row.asistieron.toLocaleString()}</td>
              <td className="py-1.5 text-right text-gray-400">
                {row.total > 0 ? `${((row.asistieron / row.total) * 100).toFixed(0)}%` : '0%'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Stat Row ───────────────────────────────────────────────────────────
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

// ── Filter Bar ─────────────────────────────────────────────────────────
function FilterBar({ idPrefix, startDate, endDate, plataforma, nivel, plataformas, niveles, loading,
  onStart, onEnd, onPlat, onNivel, onClear, onCSV }: {
  idPrefix: string
  startDate: string; endDate: string; plataforma: string; nivel: string
  plataformas: string[]; niveles: string[]; loading: boolean
  onStart: (v: string) => void; onEnd: (v: string) => void
  onPlat: (v: string) => void; onNivel: (v: string) => void
  onClear: () => void; onCSV: () => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${idPrefix}-start`} className="block text-xs text-gray-500 mb-1">Fecha inicial</label>
          <input id={`${idPrefix}-start`} type="date" value={startDate} onChange={e => onStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-end`} className="block text-xs text-gray-500 mb-1">Fecha final</label>
          <input id={`${idPrefix}-end`} type="date" value={endDate} onChange={e => onEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-plat`} className="block text-xs text-gray-500 mb-1">Plataforma</label>
          <select id={`${idPrefix}-plat`} value={plataforma} onChange={e => onPlat(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas</option>
            {plataformas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-nivel`} className="block text-xs text-gray-500 mb-1">Nivel</label>
          <select id={`${idPrefix}-nivel`} value={nivel} onChange={e => onNivel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            {niveles.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={onClear}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Limpiar filtros
          </button>
          <button type="button" onClick={onCSV} disabled={loading}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Descargar CSV
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function InformeSesionesPage() {
  // Sesiones state
  const [sesStart, setSesStart]   = useState(firstOfYear)
  const [sesEnd, setSesEnd]       = useState(today)
  const [sesPlat, setSesPlat]     = useState('')
  const [sesNivel, setSesNivel]   = useState('')
  const [sesData, setSesData]     = useState<SesResponse | null>(null)
  const [sesLoading, setSesLoading] = useState(true)

  // Jumps state
  const [jmpStart, setJmpStart]   = useState(firstOfYear)
  const [jmpEnd, setJmpEnd]       = useState(today)
  const [jmpPlat, setJmpPlat]     = useState('')
  const [jmpNivel, setJmpNivel]   = useState('')
  const [jmpData, setJmpData]     = useState<JmpResponse | null>(null)
  const [jmpLoading, setJmpLoading] = useState(true)

  const fetchSesiones = useCallback(async () => {
    setSesLoading(true)
    try {
      const qs = new URLSearchParams({ startDate: sesStart, endDate: sesEnd, plataforma: sesPlat, nivel: sesNivel })
      const res = await fetch(`/api/postgres/reports/asistencia/sesiones?${qs}`)
      const json = await res.json()
      if (json.success) setSesData(json)
    } catch (e) { console.error(e) }
    finally { setSesLoading(false) }
  }, [sesStart, sesEnd, sesPlat, sesNivel])

  const fetchJumps = useCallback(async () => {
    setJmpLoading(true)
    try {
      const qs = new URLSearchParams({ startDate: jmpStart, endDate: jmpEnd, plataforma: jmpPlat, nivel: jmpNivel })
      const res = await fetch(`/api/postgres/reports/asistencia/jumps?${qs}`)
      const json = await res.json()
      if (json.success) setJmpData(json)
    } catch (e) { console.error(e) }
    finally { setJmpLoading(false) }
  }, [jmpStart, jmpEnd, jmpPlat, jmpNivel])

  useEffect(() => { fetchSesiones() }, [fetchSesiones])
  useEffect(() => { fetchJumps() }, [fetchJumps])

  const s = sesData?.sesiones ?? { total: 0, asistieron: 0, noAsistieron: 0, cancelaron: 0 }
  const j = jmpData?.jumps    ?? { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0 }

  const sesSegments = [
    { label: 'Asistieron',    value: s.asistieron,   color: '#3b82f6' },
    { label: 'No asistieron', value: s.noAsistieron, color: '#f59e0b' },
    { label: 'Cancelaron',    value: s.cancelaron,   color: '#ef4444' },
  ]
  const sinRegistrar = Math.max(0, j.asistieron - j.aprobaron - j.noAprobaron)
  const jumpSegments = [
    { label: 'Aprobaron',     value: j.aprobaron,   color: '#10b981' },
    { label: 'No aprobaron',  value: j.noAprobaron, color: '#f59e0b' },
    { label: 'Cancelaron',    value: j.cancelaron,  color: '#ef4444' },
    { label: 'Sin registrar', value: sinRegistrar,  color: '#6b7280' },
  ]

  const handleCSVSesiones = () => {
    const rows = [
      { s: 'Filtros',   c: 'Fecha inicial',   v: sesStart,              p: '' },
      { s: 'Filtros',   c: 'Fecha final',      v: sesEnd,                p: '' },
      { s: 'Filtros',   c: 'Plataforma',       v: sesPlat || 'Todas',   p: '' },
      { s: 'Filtros',   c: 'Nivel',            v: sesNivel || 'Todos',  p: '' },
      { s: 'Sesiones',  c: 'Total',            v: s.total,               p: '' },
      { s: 'Sesiones',  c: 'Asistieron',       v: s.asistieron,          p: s.total > 0 ? `${((s.asistieron / s.total) * 100).toFixed(1)}%` : '0%' },
      { s: 'Sesiones',  c: 'No asistieron',    v: s.noAsistieron,        p: s.total > 0 ? `${((s.noAsistieron / s.total) * 100).toFixed(1)}%` : '0%' },
      { s: 'Sesiones',  c: 'Cancelaron',       v: s.cancelaron,          p: s.total > 0 ? `${((s.cancelaron / s.total) * 100).toFixed(1)}%` : '0%' },
    ]
    exportToExcel(rows, [
      { header: 'Sección',    accessor: r => r.s },
      { header: 'Categoría',  accessor: r => r.c },
      { header: 'Cantidad',   accessor: r => r.v },
      { header: 'Porcentaje', accessor: r => r.p },
    ], `informe-sesiones_${sesStart}_${sesEnd}`)
  }

  const handleCSVJumps = () => {
    const rows = [
      { s: 'Filtros', c: 'Fecha inicial',       v: jmpStart,             p: '' },
      { s: 'Filtros', c: 'Fecha final',          v: jmpEnd,               p: '' },
      { s: 'Filtros', c: 'Plataforma',           v: jmpPlat || 'Todas',  p: '' },
      { s: 'Filtros', c: 'Nivel',                v: jmpNivel || 'Todos', p: '' },
      { s: 'Jumps',   c: 'Total programados',    v: j.total,              p: '' },
      { s: 'Jumps',   c: 'Asistieron',           v: j.asistieron,         p: j.total > 0 ? `${((j.asistieron / j.total) * 100).toFixed(1)}%` : '0%' },
      { s: 'Jumps',   c: 'Aprobaron',            v: j.aprobaron,          p: j.asistieron > 0 ? `${((j.aprobaron / j.asistieron) * 100).toFixed(1)}%` : '0%' },
      { s: 'Jumps',   c: 'No aprobaron',         v: j.noAprobaron,        p: j.asistieron > 0 ? `${((j.noAprobaron / j.asistieron) * 100).toFixed(1)}%` : '0%' },
      { s: 'Jumps',   c: 'Sin registrar',        v: sinRegistrar,         p: j.asistieron > 0 ? `${((sinRegistrar / j.asistieron) * 100).toFixed(1)}%` : '0%' },
      { s: 'Jumps',   c: 'Cancelaron',           v: j.cancelaron,         p: j.total > 0 ? `${((j.cancelaron / j.total) * 100).toFixed(1)}%` : '0%' },
    ]
    exportToExcel(rows, [
      { header: 'Sección',    accessor: r => r.s },
      { header: 'Categoría',  accessor: r => r.c },
      { header: 'Cantidad',   accessor: r => r.v },
      { header: 'Porcentaje', accessor: r => r.p },
    ], `informe-jumps_${jmpStart}_${jmpEnd}`)
  }

  return (
    <DashboardLayout>
      <div className="flex gap-5 min-h-screen">

        {/* ── Left Panel ── */}
        <aside className="w-60 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-4">
            <h2 className="text-base font-bold text-gray-900 mb-1">Informe de Sesiones y Jumps</h2>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Sesiones</p>
            <p className="text-xs text-gray-400 mb-2">{sesStart} → {sesEnd}{sesPlat && <span className="block">{sesPlat}</span>}{sesNivel && <span className="block">{sesNivel}</span>}</p>
            <StatRow label="Total"         value={s.total}        color="#6b7280" />
            <StatRow label="Asistieron"    value={s.asistieron}   color="#3b82f6" />
            <StatRow label="No asistieron" value={s.noAsistieron} color="#f59e0b" />
            <StatRow label="Cancelaron"    value={s.cancelaron}   color="#ef4444" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Jumps</p>
            <p className="text-xs text-gray-400 mb-2">{jmpStart} → {jmpEnd}{jmpPlat && <span className="block">{jmpPlat}</span>}{jmpNivel && <span className="block">{jmpNivel}</span>}</p>
            <StatRow label="Total"        value={j.total}       color="#6b7280" />
            <StatRow label="Asistieron"   value={j.asistieron}  color="#3b82f6" />
            <StatRow label="Aprobaron"    value={j.aprobaron}   color="#10b981" />
            <StatRow label="No aprobaron" value={j.noAprobaron} color="#f59e0b" />
            <StatRow label="Cancelaron"   value={j.cancelaron}  color="#ef4444" />
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 space-y-5">

          {/* ── SESIONES ── */}
          <FilterBar
            idPrefix="ses"
            startDate={sesStart} endDate={sesEnd} plataforma={sesPlat} nivel={sesNivel}
            plataformas={sesData?.plataformas ?? []} niveles={sesData?.niveles ?? []}
            loading={sesLoading}
            onStart={setSesStart} onEnd={setSesEnd} onPlat={setSesPlat} onNivel={setSesNivel}
            onClear={() => { setSesStart(firstOfYear); setSesEnd(today); setSesPlat(''); setSesNivel('') }}
            onCSV={handleCSVSesiones}
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Sesiones</h3>
                <p className="text-xs text-gray-400 mt-0.5">Steps 1–45 excluyendo múltiplos de 5 + ESS</p>
              </div>
              {sesLoading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
            </div>
            <div className="flex gap-6">
              <div className="flex-1 min-w-0">
                <DonutChart segments={sesSegments} />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {sesSegments.map(seg => (
                    <div key={seg.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: seg.color + '15' }}>
                      <p className="text-2xl font-bold" style={{ color: seg.color }}>{seg.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{seg.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <PlatTable data={sesData?.sesPorPlataforma ?? []} />
            </div>
          </div>

          {/* ── JUMPS ── */}
          <FilterBar
            idPrefix="jmp"
            startDate={jmpStart} endDate={jmpEnd} plataforma={jmpPlat} nivel={jmpNivel}
            plataformas={jmpData?.plataformas ?? []} niveles={jmpData?.niveles ?? []}
            loading={jmpLoading}
            onStart={setJmpStart} onEnd={setJmpEnd} onPlat={setJmpPlat} onNivel={setJmpNivel}
            onClear={() => { setJmpStart(firstOfYear); setJmpEnd(today); setJmpPlat(''); setJmpNivel('') }}
            onCSV={handleCSVJumps}
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Jumps</h3>
                <p className="text-xs text-gray-400 mt-0.5">Steps múltiplos de 5 (5, 10, 15 … 45)</p>
              </div>
              {jmpLoading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
            </div>
            <div className="flex gap-6">
              <div className="flex-1 min-w-0">
                <DonutChart segments={jumpSegments} />
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {jumpSegments.map(seg => (
                    <div key={seg.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: seg.color + '15' }}>
                      <p className="text-2xl font-bold" style={{ color: seg.color }}>{seg.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{seg.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 text-sm">
                  <span className="text-gray-500">Total programados:</span>
                  <span className="font-bold text-gray-900 text-lg">{j.total.toLocaleString()}</span>
                </div>
              </div>
              <PlatTable data={jmpData?.porPlataforma ?? []} />
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
