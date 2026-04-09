'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'

// ── Types ──────────────────────────────────────────────────────────────
interface Stats { total: number; asistieron: number; noAsistieron: number; cancelaron: number }
interface ClubType extends Stats { tipoClub: string }
interface PlatRow { plataforma: string; total: number; asistieron: number; cancelaron: number }
interface TrainingResp { training: Stats; plataformas: string[]; niveles: string[]; porPlataforma: PlatRow[] }
interface ClubesResp  { clubesTotals: Stats; clubesPorTipo: ClubType[]; sinTipo: number; tiposClub: string[]; plataformas: string[]; niveles: string[] }

const today       = new Date().toISOString().split('T')[0]
const firstOfYear = `${new Date().getFullYear()}-01-01`

// ── Donut Chart ────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0)
  const r = 55, cx = 70, cy = 70, sw = 22, circ = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {total === 0
          ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
          : segments.map((seg, i) => {
              const dash = (seg.value / total) * circ
              const rot = offset * 360 - 90; offset += seg.value / total
              return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
                strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="butt"
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

// ── Horizontal Bar Chart ───────────────────────────────────────────────
function HorizontalBarChart({ data }: { data: ClubType[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">Sin datos para los filtros seleccionados</p>
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="space-y-4 mt-2">
      <div className="flex items-center gap-5 text-xs text-gray-500 mb-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-blue-500" /> Asistieron</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-amber-400" /> No asistieron</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-red-400" /> Cancelaron</span>
      </div>
      {data.map((club) => {
        const W = 360
        const pctAsi = club.total > 0 ? ((club.asistieron / club.total) * 100).toFixed(0) : '0'
        return (
          <div key={club.tipoClub}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{club.tipoClub || 'Sin nombre'}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-blue-600 font-semibold">{club.asistieron.toLocaleString()} ({pctAsi}%)</span>
                <span className="text-gray-500">Total: <span className="font-semibold text-gray-800">{club.total.toLocaleString()}</span></span>
              </div>
            </div>
            <div className="flex h-7 rounded-lg overflow-hidden bg-gray-100">
              {club.asistieron > 0   && <div style={{ width: (club.asistieron   / maxTotal) * W }} className="bg-blue-500" title={`Asistieron: ${club.asistieron}`} />}
              {club.noAsistieron > 0 && <div style={{ width: (club.noAsistieron / maxTotal) * W }} className="bg-amber-400" title={`No asistieron: ${club.noAsistieron}`} />}
              {club.cancelaron > 0   && <div style={{ width: (club.cancelaron   / maxTotal) * W }} className="bg-red-400"   title={`Cancelaron: ${club.cancelaron}`} />}
            </div>
          </div>
        )
      })}
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

// ── Download Icon ──────────────────────────────────────────────────────
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

// ── Main Page ──────────────────────────────────────────────────────────
export default function InformeClubesPage() {
  // Training state
  const [trStart, setTrStart]   = useState(firstOfYear)
  const [trEnd, setTrEnd]       = useState(today)
  const [trPlat, setTrPlat]     = useState('')
  const [trNivel, setTrNivel]   = useState('')
  const [trData, setTrData]     = useState<TrainingResp | null>(null)
  const [trLoading, setTrLoading] = useState(true)

  // Clubs state
  const [clStart, setClStart]     = useState(firstOfYear)
  const [clEnd, setClEnd]         = useState(today)
  const [clPlat, setClPlat]       = useState('')
  const [clNivel, setClNivel]     = useState('')
  const [clTipo, setClTipo]       = useState('')
  const [clData, setClData]       = useState<ClubesResp | null>(null)
  const [clLoading, setClLoading] = useState(true)

  const fetchTraining = useCallback(async () => {
    setTrLoading(true)
    try {
      const qs = new URLSearchParams({ startDate: trStart, endDate: trEnd, plataforma: trPlat, nivel: trNivel })
      const res = await fetch(`/api/postgres/reports/asistencia/training?${qs}`)
      const json = await res.json()
      if (json.success) setTrData(json)
    } catch (e) { console.error(e) }
    finally { setTrLoading(false) }
  }, [trStart, trEnd, trPlat, trNivel])

  const fetchClubes = useCallback(async () => {
    setClLoading(true)
    try {
      const qs = new URLSearchParams({ startDate: clStart, endDate: clEnd, plataforma: clPlat, nivel: clNivel, tipoClub: clTipo })
      const res = await fetch(`/api/postgres/reports/asistencia/clubes?${qs}`)
      const json = await res.json()
      if (json.success) setClData(json)
    } catch (e) { console.error(e) }
    finally { setClLoading(false) }
  }, [clStart, clEnd, clPlat, clNivel, clTipo])

  useEffect(() => { fetchTraining() }, [fetchTraining])
  useEffect(() => { fetchClubes() }, [fetchClubes])

  const tr = trData?.training    ?? { total: 0, asistieron: 0, noAsistieron: 0, cancelaron: 0 }
  const ct = clData?.clubesTotals ?? { total: 0, asistieron: 0, noAsistieron: 0, cancelaron: 0 }

  const trSegments = [
    { label: 'Asistieron',    value: tr.asistieron,   color: '#3b82f6' },
    { label: 'No asistieron', value: tr.noAsistieron, color: '#f59e0b' },
    { label: 'Cancelaron',    value: tr.cancelaron,   color: '#ef4444' },
  ]

  const handleCSVTraining = () => {
    const rows = [
      { s: 'Filtros',           c: 'Fecha inicial',   v: trStart,             p: '' },
      { s: 'Filtros',           c: 'Fecha final',      v: trEnd,               p: '' },
      { s: 'Filtros',           c: 'Plataforma',       v: trPlat || 'Todas',  p: '' },
      { s: 'Filtros',           c: 'Nivel',            v: trNivel || 'Todos', p: '' },
      { s: 'Training Session',  c: 'Total',            v: tr.total,            p: '' },
      { s: 'Training Session',  c: 'Asistieron',       v: tr.asistieron,       p: tr.total > 0 ? `${((tr.asistieron / tr.total) * 100).toFixed(1)}%` : '0%' },
      { s: 'Training Session',  c: 'No asistieron',    v: tr.noAsistieron,     p: tr.total > 0 ? `${((tr.noAsistieron / tr.total) * 100).toFixed(1)}%` : '0%' },
      { s: 'Training Session',  c: 'Cancelaron',       v: tr.cancelaron,       p: tr.total > 0 ? `${((tr.cancelaron / tr.total) * 100).toFixed(1)}%` : '0%' },
    ]
    exportToExcel(rows, [
      { header: 'Sección', accessor: r => r.s }, { header: 'Categoría', accessor: r => r.c },
      { header: 'Cantidad', accessor: r => r.v }, { header: 'Porcentaje', accessor: r => r.p },
    ], `training-session_${trStart}_${trEnd}`)
  }

  const handleCSVClubes = () => {
    const rows: { s: string; c: string; v: string | number; p: string }[] = [
      { s: 'Filtros', c: 'Fecha inicial',   v: clStart,              p: '' },
      { s: 'Filtros', c: 'Fecha final',      v: clEnd,                p: '' },
      { s: 'Filtros', c: 'Plataforma',       v: clPlat || 'Todas',   p: '' },
      { s: 'Filtros', c: 'Nivel',            v: clNivel || 'Todos',  p: '' },
      { s: 'Filtros', c: 'Tipo de Club',     v: clTipo || 'Todos',   p: '' },
      { s: 'Clubs',   c: 'Total',            v: ct.total,             p: '' },
      { s: 'Clubs',   c: 'Asistieron',       v: ct.asistieron,        p: ct.total > 0 ? `${((ct.asistieron / ct.total) * 100).toFixed(1)}%` : '0%' },
      { s: 'Clubs',   c: 'No asistieron',    v: ct.noAsistieron,      p: ct.total > 0 ? `${((ct.noAsistieron / ct.total) * 100).toFixed(1)}%` : '0%' },
      { s: 'Clubs',   c: 'Cancelaron',       v: ct.cancelaron,        p: ct.total > 0 ? `${((ct.cancelaron / ct.total) * 100).toFixed(1)}%` : '0%' },
    ];
    (clData?.clubesPorTipo ?? []).forEach(club => {
      rows.push({ s: club.tipoClub, c: 'Total',         v: club.total,        p: '' })
      rows.push({ s: club.tipoClub, c: 'Asistieron',    v: club.asistieron,   p: club.total > 0 ? `${((club.asistieron / club.total) * 100).toFixed(1)}%` : '0%' })
      rows.push({ s: club.tipoClub, c: 'No asistieron', v: club.noAsistieron, p: club.total > 0 ? `${((club.noAsistieron / club.total) * 100).toFixed(1)}%` : '0%' })
      rows.push({ s: club.tipoClub, c: 'Cancelaron',    v: club.cancelaron,   p: club.total > 0 ? `${((club.cancelaron / club.total) * 100).toFixed(1)}%` : '0%' })
    })
    exportToExcel(rows, [
      { header: 'Tipo Club', accessor: r => r.s }, { header: 'Categoría', accessor: r => r.c },
      { header: 'Cantidad',  accessor: r => r.v }, { header: 'Porcentaje', accessor: r => r.p },
    ], `clubes_${clStart}_${clEnd}`)
  }

  return (
    <DashboardLayout>
      <div className="flex gap-5 min-h-screen">

        {/* ── Left Panel ── */}
        <aside className="w-60 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-4 space-y-1">
            <h2 className="text-base font-bold text-gray-900 mb-3">Training Session y Clubes</h2>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Training Session</p>
            <p className="text-xs text-gray-400 mb-2">{trStart} → {trEnd}{trPlat && <span className="block">{trPlat}</span>}{trNivel && <span className="block">{trNivel}</span>}</p>
            <StatRow label="Total"         value={tr.total}        color="#6b7280" />
            <StatRow label="Asistieron"    value={tr.asistieron}   color="#3b82f6" />
            <StatRow label="No asistieron" value={tr.noAsistieron} color="#f59e0b" />
            <StatRow label="Cancelaron"    value={tr.cancelaron}   color="#ef4444" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-1">Clubs</p>
            <p className="text-xs text-gray-400 mb-2">{clStart} → {clEnd}{clPlat && <span className="block">{clPlat}</span>}{clNivel && <span className="block">{clNivel}</span>}{clTipo && <span className="block">{clTipo}</span>}</p>
            <StatRow label="Total"         value={ct.total}        color="#6b7280" />
            <StatRow label="Asistieron"    value={ct.asistieron}   color="#3b82f6" />
            <StatRow label="No asistieron" value={ct.noAsistieron} color="#f59e0b" />
            <StatRow label="Cancelaron"    value={ct.cancelaron}   color="#ef4444" />
          </div>
        </aside>

        <div className="flex-1 space-y-5">

          {/* ══ TRAINING SESSION ══ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="tr-start" className="block text-xs text-gray-500 mb-1">Fecha inicial</label>
                <input id="tr-start" type="date" value={trStart} onChange={e => setTrStart(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="tr-end" className="block text-xs text-gray-500 mb-1">Fecha final</label>
                <input id="tr-end" type="date" value={trEnd} onChange={e => setTrEnd(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="tr-plat" className="block text-xs text-gray-500 mb-1">Plataforma</label>
                <select id="tr-plat" value={trPlat} onChange={e => setTrPlat(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todas</option>
                  {(trData?.plataformas ?? []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="tr-nivel" className="block text-xs text-gray-500 mb-1">Nivel</label>
                <select id="tr-nivel" value={trNivel} onChange={e => setTrNivel(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todos</option>
                  {(trData?.niveles ?? []).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => { setTrStart(firstOfYear); setTrEnd(today); setTrPlat(''); setTrNivel('') }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Limpiar filtros
                </button>
                <button type="button" onClick={handleCSVTraining} disabled={trLoading}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  <DownloadIcon /> Descargar CSV
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Training Session</h3>
                <p className="text-xs text-gray-400 mt-0.5">TRAINING – Steps 1–45 excluyendo múltiplos de 5</p>
              </div>
              {trLoading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
            </div>
            <div className="flex gap-6">
              <div className="flex-1 min-w-0">
                <DonutChart segments={trSegments} />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {trSegments.map(seg => (
                    <div key={seg.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: seg.color + '15' }}>
                      <p className="text-2xl font-bold" style={{ color: seg.color }}>{seg.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{seg.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <PlatTable data={trData?.porPlataforma ?? []} />
            </div>
          </div>

          {/* ══ CLUBS ══ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="cl-start" className="block text-xs text-gray-500 mb-1">Fecha inicial</label>
                <input id="cl-start" type="date" value={clStart} onChange={e => setClStart(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="cl-end" className="block text-xs text-gray-500 mb-1">Fecha final</label>
                <input id="cl-end" type="date" value={clEnd} onChange={e => setClEnd(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="cl-plat" className="block text-xs text-gray-500 mb-1">Plataforma</label>
                <select id="cl-plat" value={clPlat} onChange={e => setClPlat(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todas</option>
                  {(clData?.plataformas ?? []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cl-nivel" className="block text-xs text-gray-500 mb-1">Nivel</label>
                <select id="cl-nivel" value={clNivel} onChange={e => setClNivel(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todos</option>
                  {(clData?.niveles ?? []).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cl-tipo" className="block text-xs text-gray-500 mb-1">Tipo de Club</label>
                <select id="cl-tipo" value={clTipo} onChange={e => setClTipo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todos</option>
                  {(clData?.tiposClub ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => { setClStart(firstOfYear); setClEnd(today); setClPlat(''); setClNivel(''); setClTipo('') }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Limpiar filtros
                </button>
                <button type="button" onClick={handleCSVClubes} disabled={clLoading}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  <DownloadIcon /> Descargar CSV
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Clubs</h3>
                <p className="text-xs text-gray-400 mt-0.5">Todos los clubes excepto TRAINING — por tipo</p>
              </div>
              {clLoading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
            </div>
            <HorizontalBarChart data={clData?.clubesPorTipo ?? []} />
            {(clData?.sinTipo ?? 0) > 0 && (
              <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-amber-800">Clubs sin tipo: </span>
                  <span className="text-sm font-bold text-amber-900">{(clData?.sinTipo ?? 0).toLocaleString()} registros</span>
                  <span className="text-xs text-amber-600 block mt-0.5">Registros con tipoEvento=CLUB pero nombreEvento="Step X" — requieren corrección en la BD</span>
                </div>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-4 gap-3">
              {[
                { label: 'Total',         value: ct.total,        color: '#6b7280' },
                { label: 'Asistieron',    value: ct.asistieron,   color: '#3b82f6' },
                { label: 'No asistieron', value: ct.noAsistieron, color: '#f59e0b' },
                { label: 'Cancelaron',    value: ct.cancelaron,   color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: s.color + '15' }}>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
