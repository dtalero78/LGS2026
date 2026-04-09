'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'

// ── Types ──────────────────────────────────────────────────────────────
interface PlatRow {
  plataforma: string; total: number; asistieron: number; cancelaron: number
  aprobaron?: number; noAprobaron?: number
}
interface Section {
  total: number; asistieron: number; cancelaron: number
  aprobaron: number; noAprobaron: number
  porPlataforma: PlatRow[]
}
interface XPaisResponse {
  sesiones: Section; jumps: Section; training: Section
  clubes: Section; welcome: Section; complementarias: Section
}

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
              const pct = seg.value / total
              const dash = pct * circ
              const rot = offset * 360 - 90; offset += pct
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

// ── Country Table ──────────────────────────────────────────────────────
function CountryTable({ rows, metricKey = 'asistieron', metricLabel = 'Asistieron' }: {
  rows: PlatRow[]; metricKey?: string; metricLabel?: string
}) {
  if (!rows || rows.length === 0) return <p className="text-xs text-gray-400 py-4 text-center">Sin datos por plataforma</p>
  return (
    <div className="overflow-auto max-h-48">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="text-gray-400 border-b border-gray-100">
            <th className="text-left font-medium pb-1.5 pr-3">País</th>
            <th className="text-right font-medium pb-1.5 pr-2">Total</th>
            <th className="text-right font-medium pb-1.5 pr-2 text-blue-400">{metricLabel}</th>
            <th className="text-right font-medium pb-1.5">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const metric = (row as any)[metricKey] ?? 0
            const pct = row.total > 0 ? ((metric / row.total) * 100).toFixed(0) : '0'
            return (
              <tr key={row.plataforma} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5 pr-3 text-gray-700 font-medium">{row.plataforma}</td>
                <td className="py-1.5 pr-2 text-right text-gray-500">{row.total.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-right text-blue-600 font-semibold">{metric.toLocaleString()}</td>
                <td className="py-1.5 text-right text-gray-400">{pct}%</td>
              </tr>
            )
          })}
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

// ── Section Card ───────────────────────────────────────────────────────
function SectionCard({ title, subtitle, segments, statCards, porPlataforma, metricKey, metricLabel, loading }: {
  title: string; subtitle: string
  segments: { label: string; value: number; color: string }[]
  statCards: { label: string; value: number; color: string }[]
  porPlataforma: PlatRow[]
  metricKey?: string; metricLabel?: string; loading: boolean
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Cargando...</span>}
      </div>
      <div className="flex gap-6">
        {/* Donut + stat cards */}
        <div className="flex-1 min-w-0">
          <DonutChart segments={segments} />
          <div className={`mt-4 grid gap-3 grid-cols-${Math.min(statCards.length, 4)}`}>
            {statCards.map(card => (
              <div key={card.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: card.color + '15' }}>
                <p className="text-xl font-bold" style={{ color: card.color }}>{card.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Country table */}
        <div className="border-l border-gray-100 pl-5 w-64 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por País</p>
          <CountryTable rows={porPlataforma} metricKey={metricKey} metricLabel={metricLabel} />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function InformeXPaisPage() {
  const [startDate, setStartDate] = useState(firstOfYear)
  const [endDate, setEndDate]     = useState(today)
  const [data, setData]           = useState<XPaisResponse | null>(null)
  const [loading, setLoading]     = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/postgres/reports/asistencia/x-pais?${qs}`)
      const json = await res.json()
      if (json.success) setData(json)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const ses  = data?.sesiones        ?? { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0, porPlataforma: [] }
  const jmp  = data?.jumps           ?? { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0, porPlataforma: [] }
  const tr   = data?.training        ?? { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0, porPlataforma: [] }
  const cl   = data?.clubes          ?? { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0, porPlataforma: [] }
  const wel  = data?.welcome         ?? { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0, porPlataforma: [] }
  const comp = data?.complementarias ?? { total: 0, asistieron: 0, cancelaron: 0, aprobaron: 0, noAprobaron: 0, porPlataforma: [] }

  // Helpers para calcular segmentos
  const noAsi = (s: Section) => Math.max(0, s.total - s.asistieron - s.cancelaron)
  const jmpSinReg = Math.max(0, jmp.asistieron - jmp.aprobaron - jmp.noAprobaron)

  // CSV export
  const handleCSV = () => {
    type Row = { sec: string; cat: string; v: number | string; p: string }
    const rows: Row[] = [
      { sec: 'Filtros', cat: 'Fecha inicial', v: startDate, p: '' },
      { sec: 'Filtros', cat: 'Fecha final',   v: endDate,   p: '' },
    ]
    const addSection = (label: string, s: Section, metric: string, metricLabel: string) => {
      const m = (s as any)[metric] ?? s.asistieron
      rows.push(
        { sec: label, cat: 'Total',       v: s.total,       p: '' },
        { sec: label, cat: metricLabel,   v: m,             p: s.total > 0 ? `${((m / s.total) * 100).toFixed(1)}%` : '0%' },
      )
      s.porPlataforma.forEach(r => {
        const rm = (r as any)[metric] ?? r.asistieron
        rows.push({ sec: `${label} — ${r.plataforma}`, cat: metricLabel, v: rm, p: r.total > 0 ? `${((rm / r.total) * 100).toFixed(1)}%` : '0%' })
      })
    }
    addSection('SESIONES',        ses,  'asistieron', 'Asistieron')
    addSection('JUMPS',           jmp,  'aprobaron',  'Aprobaron')
    addSection('TRAINING',        tr,   'asistieron', 'Asistieron')
    addSection('CLUBES',          cl,   'asistieron', 'Asistieron')
    addSection('WELCOME',         wel,  'asistieron', 'Asistieron')
    addSection('COMPLEMENTARIAS', comp, 'asistieron', 'Asistieron')
    exportToExcel(rows, [
      { header: 'Sección',    accessor: r => r.sec },
      { header: 'Categoría',  accessor: r => r.cat },
      { header: 'Cantidad',   accessor: r => r.v },
      { header: 'Porcentaje', accessor: r => r.p },
    ], `asistencia-x-pais_${startDate}_${endDate}`)
  }

  return (
    <DashboardLayout>
      <div className="flex gap-5 min-h-screen">

        {/* ── Left Panel: RESUMEN ── */}
        <aside className="w-60 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-4">
            <h2 className="text-base font-bold text-gray-900 mb-1">Resumen</h2>
            <p className="text-xs text-gray-400 mb-4">{startDate} → {endDate}</p>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sesiones</p>
            <StatRow label="Total"      value={ses.total}      color="#6b7280" />
            <StatRow label="Asistieron" value={ses.asistieron} color="#3b82f6" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Jumps</p>
            <StatRow label="Total"     value={jmp.total}     color="#6b7280" />
            <StatRow label="Aprobaron" value={jmp.aprobaron} color="#10b981" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Training</p>
            <StatRow label="Total"      value={tr.total}      color="#6b7280" />
            <StatRow label="Asistieron" value={tr.asistieron} color="#3b82f6" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Clubes</p>
            <StatRow label="Total"      value={cl.total}      color="#6b7280" />
            <StatRow label="Asistieron" value={cl.asistieron} color="#3b82f6" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Welcome</p>
            <StatRow label="Total"      value={wel.total}      color="#6b7280" />
            <StatRow label="Asistieron" value={wel.asistieron} color="#3b82f6" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Complementarias</p>
            <StatRow label="Total"      value={comp.total}      color="#6b7280" />
            <StatRow label="Asistieron" value={comp.asistieron} color="#8b5cf6" />
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 space-y-5">

          {/* ── Filter Bar ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="xp-start" className="block text-xs text-gray-500 mb-1">Fecha inicial</label>
                <input id="xp-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="xp-end" className="block text-xs text-gray-500 mb-1">Fecha final</label>
                <input id="xp-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => { setStartDate(firstOfYear); setEndDate(today) }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Limpiar filtros
                </button>
                <button type="button" onClick={handleCSV} disabled={loading}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Descargar CSV
                </button>
              </div>
            </div>
          </div>

          {/* ── SESIONES ── */}
          <SectionCard
            title="Sesiones" subtitle="SESSION — Step 0–45 excl. múltiplos de 5"
            loading={loading}
            segments={[
              { label: 'Asistieron',    value: ses.asistieron,     color: '#3b82f6' },
              { label: 'No asistieron', value: noAsi(ses),          color: '#f59e0b' },
              { label: 'Cancelaron',    value: ses.cancelaron,      color: '#ef4444' },
            ]}
            statCards={[
              { label: 'Asistieron',    value: ses.asistieron,     color: '#3b82f6' },
              { label: 'No asistieron', value: noAsi(ses),          color: '#f59e0b' },
              { label: 'Cancelaron',    value: ses.cancelaron,      color: '#ef4444' },
            ]}
            porPlataforma={ses.porPlataforma}
            metricKey="asistieron" metricLabel="Asistieron"
          />

          {/* ── JUMPS ── */}
          <SectionCard
            title="Jumps" subtitle="SESSION — Steps múltiplos de 5 (5, 10, 15 … 45)"
            loading={loading}
            segments={[
              { label: 'Aprobaron',     value: jmp.aprobaron,   color: '#10b981' },
              { label: 'No aprobaron',  value: jmp.noAprobaron, color: '#f59e0b' },
              { label: 'Cancelaron',    value: jmp.cancelaron,  color: '#ef4444' },
              { label: 'Sin registrar', value: jmpSinReg,        color: '#6b7280' },
            ]}
            statCards={[
              { label: 'Aprobaron',     value: jmp.aprobaron,   color: '#10b981' },
              { label: 'No aprobaron',  value: jmp.noAprobaron, color: '#f59e0b' },
              { label: 'Cancelaron',    value: jmp.cancelaron,  color: '#ef4444' },
              { label: 'Sin registrar', value: jmpSinReg,        color: '#6b7280' },
            ]}
            porPlataforma={jmp.porPlataforma}
            metricKey="aprobaron" metricLabel="Aprobaron"
          />

          {/* ── TRAINING ── */}
          <SectionCard
            title="Training" subtitle="CLUB — TRAINING – Step X"
            loading={loading}
            segments={[
              { label: 'Asistieron',    value: tr.asistieron, color: '#3b82f6' },
              { label: 'No asistieron', value: noAsi(tr),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: tr.cancelaron,  color: '#ef4444' },
            ]}
            statCards={[
              { label: 'Asistieron',    value: tr.asistieron, color: '#3b82f6' },
              { label: 'No asistieron', value: noAsi(tr),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: tr.cancelaron,  color: '#ef4444' },
            ]}
            porPlataforma={tr.porPlataforma}
            metricKey="asistieron" metricLabel="Asistieron"
          />

          {/* ── CLUBES ── */}
          <SectionCard
            title="Clubes" subtitle="CLUB — GRAMMAR / LISTENING / KARAOKE / PRONUNCIATION / CONVERSATION"
            loading={loading}
            segments={[
              { label: 'Asistieron',    value: cl.asistieron, color: '#3b82f6' },
              { label: 'No asistieron', value: noAsi(cl),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: cl.cancelaron,  color: '#ef4444' },
            ]}
            statCards={[
              { label: 'Asistieron',    value: cl.asistieron, color: '#3b82f6' },
              { label: 'No asistieron', value: noAsi(cl),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: cl.cancelaron,  color: '#ef4444' },
            ]}
            porPlataforma={cl.porPlataforma}
            metricKey="asistieron" metricLabel="Asistieron"
          />

          {/* ── WELCOME ── */}
          <SectionCard
            title="Welcome" subtitle="Nivel WELCOME — sesiones de bienvenida"
            loading={loading}
            segments={[
              { label: 'Asistieron',    value: wel.asistieron, color: '#8b5cf6' },
              { label: 'No asistieron', value: noAsi(wel),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: wel.cancelaron,  color: '#ef4444' },
            ]}
            statCards={[
              { label: 'Asistieron',    value: wel.asistieron, color: '#8b5cf6' },
              { label: 'No asistieron', value: noAsi(wel),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: wel.cancelaron,  color: '#ef4444' },
            ]}
            porPlataforma={wel.porPlataforma}
            metricKey="asistieron" metricLabel="Asistieron"
          />

          {/* ── COMPLEMENTARIAS ── */}
          <SectionCard
            title="Complementarias" subtitle="Actividades complementarias (tipo COMPLEMENTARIA)"
            loading={loading}
            segments={[
              { label: 'Asistieron',    value: comp.asistieron, color: '#10b981' },
              { label: 'No asistieron', value: noAsi(comp),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: comp.cancelaron,  color: '#ef4444' },
            ]}
            statCards={[
              { label: 'Asistieron',    value: comp.asistieron, color: '#10b981' },
              { label: 'No asistieron', value: noAsi(comp),      color: '#f59e0b' },
              { label: 'Cancelaron',    value: comp.cancelaron,  color: '#ef4444' },
            ]}
            porPlataforma={comp.porPlataforma}
            metricKey="asistieron" metricLabel="Asistieron"
          />

        </div>
      </div>
    </DashboardLayout>
  )
}

// Local type alias needed after component definitions
type Section = XPaisResponse['sesiones']
