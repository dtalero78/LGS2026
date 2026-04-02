'use client'

import { useState } from 'react'
import { exportToExcel } from '@/lib/export-excel'
import { CalendarIcon, DocumentArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NivelRow     { nivel: string; total: number }
interface BookingRow   { nivel: string; total: number; asistieron: number; cancelados: number }
interface OtroClubRow  { clase: string; nivel: string; total: number; asistieron: number }
interface PaisRow      { pais: string; tipo: string; total: number; asistieron: number; cancelados: number }

interface ReporteData {
  sesionesCalendario: NivelRow[]
  trainingCalendario: NivelRow[]
  jumpsCalendario:    NivelRow[]
  sesionesBookings:   BookingRow[]
  trainingBookings:   BookingRow[]
  otrosClubsBookings: OtroClubRow[]
  bookingsPorPais:    PaisRow[]
}

const NIVEL_COLORS: Record<string, string> = {
  BN1: 'bg-blue-500', BN2: 'bg-blue-600', BN3: 'bg-blue-700',
  P1:  'bg-violet-500', P2: 'bg-violet-600', P3: 'bg-violet-700',
  F1:  'bg-emerald-500', F2: 'bg-emerald-600', F3: 'bg-emerald-700',
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({ rows, valueKey = 'total', label = 'nivel' }: {
  rows: any[]
  valueKey?: string
  label?: string
}) {
  const max = Math.max(...rows.map(r => r[valueKey] || 0), 1)
  const total = rows.reduce((s, r) => s + (r[valueKey] || 0), 0)
  return (
    <div className="space-y-2 py-2">
      {rows.map((r, i) => {
        const val = r[valueKey] || 0
        const pct = total > 0 ? Math.round((val / total) * 100) : 0
        const barW = Math.round((val / max) * 100)
        const color = NIVEL_COLORS[r[label]] || 'bg-gray-400'
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-10 text-xs font-semibold text-gray-600 text-right shrink-0">
              {r[label]}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
              <div
                className={`${color} h-6 rounded-full transition-all duration-500`}
                style={{ width: `${barW}%` }}
              />
              {val > 0 && (
                <span className="absolute inset-0 flex items-center pl-2 text-xs font-bold text-white drop-shadow">
                  {val.toLocaleString()}
                </span>
              )}
            </div>
            <span className="w-9 text-xs text-gray-500 text-right shrink-0">{pct}%</span>
          </div>
        )
      })}
      {rows.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">Sin datos en el período</p>
      )}
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, color, onExport, children }: {
  title: string
  subtitle?: string
  color: string
  onExport: () => void
  children: React.ReactNode
}) {
  return (
    <div className="shadow rounded-lg overflow-hidden">
      <div className={`${color} px-5 py-3 flex items-center justify-between`}>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          CSV
        </button>
      </div>
      <div className="bg-white p-5">{children}</div>
    </div>
  )
}

// ─── Stat pills for booking rows ──────────────────────────────────────────────

function BookingChart({ rows }: { rows: BookingRow[] }) {
  const max = Math.max(...rows.map(r => r.total), 1)
  return (
    <div className="space-y-3 py-2">
      {rows.map((r, i) => {
        const color = NIVEL_COLORS[r.nivel] || 'bg-gray-400'
        const pctBar = Math.round((r.total / max) * 100)
        const pctAsist = r.total > 0 ? Math.round((r.asistieron / r.total) * 100) : 0
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-10 text-xs font-semibold text-gray-600 text-right shrink-0">{r.nivel}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <div className={`${color} h-6 rounded-full`} style={{ width: `${pctBar}%` }} />
                <span className="absolute inset-0 flex items-center pl-2 text-xs font-bold text-white drop-shadow">
                  {r.total.toLocaleString()} agendados
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-12">
              <div className="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
                <div className="bg-emerald-400 h-3 rounded-full" style={{ width: `${pctAsist}%` }} />
              </div>
              <span className="text-xs text-gray-500 w-24 shrink-0">
                {r.asistieron.toLocaleString()} asistieron ({pctAsist}%)
              </span>
            </div>
          </div>
        )
      })}
      {rows.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin datos en el período</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReporteMensuales() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate]     = useState(today)
  const [data, setData]           = useState<ReporteData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleGenerar = async () => {
    if (!startDate || !endDate) { setError('Selecciona ambas fechas'); return }
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/postgres/reports/mensuales?startDate=${startDate}&endDate=${endDate}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al generar el reporte')
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Pivot país ─────────────────────────────────────────────────────────────
  type PaisPivot = { pais: string; sesiones: number; clubs: number; asistSesiones: number; asistClubs: number }
  const paisPivot: PaisPivot[] = []
  if (data) {
    const map = new Map<string, PaisPivot>()
    for (const r of data.bookingsPorPais) {
      if (!map.has(r.pais)) map.set(r.pais, { pais: r.pais, sesiones: 0, clubs: 0, asistSesiones: 0, asistClubs: 0 })
      const e = map.get(r.pais)!
      if (r.tipo === 'SESSION') { e.sesiones += r.total; e.asistSesiones += r.asistieron }
      if (r.tipo === 'CLUB')    { e.clubs    += r.total; e.asistClubs    += r.asistieron }
    }
    paisPivot.push(...Array.from(map.values()).sort((a, b) => (b.sesiones + b.clubs) - (a.sesiones + a.clubs)))
  }

  // ── CSV exports ────────────────────────────────────────────────────────────
  const exp = (label: string, rows: any[], cols: any[]) =>
    exportToExcel(rows, cols, `${label}-${startDate}-${endDate}`)

  const nivelCols = [
    { header: 'Nivel', accessor: (r: NivelRow) => r.nivel },
    { header: 'Total', accessor: (r: NivelRow) => r.total },
  ]
  const bookingCols = [
    { header: 'Nivel',      accessor: (r: BookingRow) => r.nivel },
    { header: 'Agendados',  accessor: (r: BookingRow) => r.total },
    { header: 'Asistieron', accessor: (r: BookingRow) => r.asistieron },
    { header: 'Cancelados', accessor: (r: BookingRow) => r.cancelados },
    { header: '% Asistencia', accessor: (r: BookingRow) => r.total > 0 ? Math.round((r.asistieron / r.total) * 100) : 0 },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Reporte Mensual</h1>
        <p className="mt-1 text-sm text-gray-500">Estadísticas académicas por nivel — CALENDARIO y Agendamientos</p>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
            <div className="relative">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm pr-9" />
              <CalendarIcon className="absolute right-2.5 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
            <div className="relative">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm pr-9" />
              <CalendarIcon className="absolute right-2.5 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <button type="button" onClick={handleGenerar} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md shadow-sm transition-colors">
            {loading ? <><ArrowPathIcon className="h-4 w-4 animate-spin" />Generando...</> : 'Generar Reporte'}
          </button>
        </div>
        {error && <div className="mt-3 rounded-md bg-red-50 px-4 py-2"><p className="text-sm text-red-700">{error}</p></div>}
      </div>

      {data && (
        <>
          {/* ══════════════════════════════════════════════
              BLOQUE 1 — CALENDARIO
          ══════════════════════════════════════════════ */}
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-600 inline-block" />
              Estadísticas de CALENDARIO (eventos programados)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* 1. Sesiones por nivel */}
              <Section title="Sesiones por Nivel" subtitle="Eventos SESSION en CALENDARIO" color="bg-blue-600"
                onExport={() => exp('sesiones-calendario', data.sesionesCalendario, nivelCols)}>
                <BarChart rows={data.sesionesCalendario} />
                <p className="text-xs text-gray-400 mt-2 text-right">
                  Total: {data.sesionesCalendario.reduce((s, r) => s + r.total, 0).toLocaleString()}
                </p>
              </Section>

              {/* 2. Clubes TRAINING por nivel */}
              <Section title="Clubes TRAINING por Nivel" subtitle="Eventos CLUB tipo TRAINING en CALENDARIO" color="bg-violet-600"
                onExport={() => exp('training-calendario', data.trainingCalendario, nivelCols)}>
                <BarChart rows={data.trainingCalendario} />
                <p className="text-xs text-gray-400 mt-2 text-right">
                  Total: {data.trainingCalendario.reduce((s, r) => s + r.total, 0).toLocaleString()}
                </p>
              </Section>

              {/* 3. JUMPS por nivel */}
              <Section title="JUMP Sessions por Nivel" subtitle="Sessions en step múltiplo de 5" color="bg-rose-600"
                onExport={() => exp('jumps-calendario', data.jumpsCalendario, nivelCols)}>
                <BarChart rows={data.jumpsCalendario} />
                <p className="text-xs text-gray-400 mt-2 text-right">
                  Total: {data.jumpsCalendario.reduce((s, r) => s + r.total, 0).toLocaleString()}
                </p>
              </Section>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              BLOQUE 2 — AGENDAMIENTOS (ACADEMICA_BOOKINGS)
          ══════════════════════════════════════════════ */}
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600 inline-block" />
              Estadísticas de Agendamientos (ACADEMICA_BOOKINGS)
            </h2>
            <div className="space-y-4">

              {/* 4. Sesiones agendadas por nivel */}
              <Section title="Sesiones Agendadas por Nivel" subtitle="Agendados · Asistieron · Cancelados" color="bg-blue-600"
                onExport={() => exp('sesiones-bookings', data.sesionesBookings, bookingCols)}>
                <BookingChart rows={data.sesionesBookings} />
              </Section>

              {/* 5. TRAINING agendados por nivel */}
              <Section title="Clubes TRAINING Agendados por Nivel" subtitle="Agendados · Asistieron" color="bg-violet-600"
                onExport={() => exp('training-bookings', data.trainingBookings, bookingCols)}>
                <BookingChart rows={data.trainingBookings} />
              </Section>

              {/* 6. Otros clubes por clase y nivel */}
              <Section title="Otros Clubes Agendados por Clase y Nivel"
                subtitle="Clubes distintos de TRAINING — ordenados de mayor a menor"
                color="bg-amber-600"
                onExport={() => exp('otros-clubs-bookings', data.otrosClubsBookings, [
                  { header: 'Clase',      accessor: (r: OtroClubRow) => r.clase },
                  { header: 'Nivel',      accessor: (r: OtroClubRow) => r.nivel },
                  { header: 'Total',      accessor: (r: OtroClubRow) => r.total },
                  { header: 'Asistieron', accessor: (r: OtroClubRow) => r.asistieron },
                ])}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Clase', 'Nivel', 'Total', 'Asistieron', '% Asist.'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.otrosClubsBookings.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">Sin datos</td></tr>
                      )}
                      {data.otrosClubsBookings.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{r.clase}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-white text-xs font-semibold ${NIVEL_COLORS[r.nivel] || 'bg-gray-400'}`}>
                              {r.nivel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{r.total.toLocaleString()}</td>
                          <td className="px-3 py-2 text-emerald-700 font-semibold">{r.asistieron.toLocaleString()}</td>
                          <td className="px-3 py-2 text-gray-500">
                            {r.total > 0 ? Math.round((r.asistieron / r.total) * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              BLOQUE 3 — AGENDAMIENTOS POR PAÍS
          ══════════════════════════════════════════════ */}
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-teal-600 inline-block" />
              Agendamientos por País
            </h2>
            <Section title="Sesiones y Clubes por País"
              subtitle="Total agendados y asistencias discriminados por plataforma"
              color="bg-teal-600"
              onExport={() => exp('bookings-por-pais', paisPivot, [
                { header: 'País',              accessor: (r: PaisPivot) => r.pais },
                { header: 'Sesiones Agendadas', accessor: (r: PaisPivot) => r.sesiones },
                { header: 'Sesiones Asistidas', accessor: (r: PaisPivot) => r.asistSesiones },
                { header: 'Clubs Agendados',    accessor: (r: PaisPivot) => r.clubs },
                { header: 'Clubs Asistidos',    accessor: (r: PaisPivot) => r.asistClubs },
                { header: 'Total',              accessor: (r: PaisPivot) => r.sesiones + r.clubs },
              ])}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['País', 'Ses. Agendadas', 'Ses. Asistidas', '% Ses.', 'Clubs Agendados', 'Clubs Asistidos', '% Clubs'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paisPivot.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-xs">Sin datos</td></tr>
                    )}
                    {paisPivot.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{r.pais}</td>
                        <td className="px-3 py-2 text-gray-700">{r.sesiones.toLocaleString()}</td>
                        <td className="px-3 py-2 text-emerald-700 font-semibold">{r.asistSesiones.toLocaleString()}</td>
                        <td className="px-3 py-2 text-gray-500">{r.sesiones > 0 ? Math.round((r.asistSesiones / r.sesiones) * 100) : 0}%</td>
                        <td className="px-3 py-2 text-gray-700">{r.clubs.toLocaleString()}</td>
                        <td className="px-3 py-2 text-emerald-700 font-semibold">{r.asistClubs.toLocaleString()}</td>
                        <td className="px-3 py-2 text-gray-500">{r.clubs > 0 ? Math.round((r.asistClubs / r.clubs) * 100) : 0}%</td>
                      </tr>
                    ))}
                    {paisPivot.length > 0 && (
                      <tr className="bg-gray-50 font-semibold text-gray-700">
                        <td className="px-3 py-2">TOTAL</td>
                        <td className="px-3 py-2">{paisPivot.reduce((s,r)=>s+r.sesiones,0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-emerald-700">{paisPivot.reduce((s,r)=>s+r.asistSesiones,0).toLocaleString()}</td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2">{paisPivot.reduce((s,r)=>s+r.clubs,0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-emerald-700">{paisPivot.reduce((s,r)=>s+r.asistClubs,0).toLocaleString()}</td>
                        <td className="px-3 py-2" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="bg-white shadow rounded-lg p-16 text-center">
          <p className="text-gray-400 text-sm">
            Selecciona un rango de fechas y presiona <strong>Generar Reporte</strong>
          </p>
        </div>
      )}
    </div>
  )
}
