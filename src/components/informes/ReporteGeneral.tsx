'use client'

import { useState } from 'react'
import { exportToExcel } from '@/lib/export-excel'
import {
  CalendarIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResumenEvento {
  tipo: string
  totalEventos: number
  totalInscritos: number
  asistieron: number
  cancelados: number
}

interface Complementarias {
  totalSolicitadas: number
  aprobadas: number
  reprobadas: number
  enProgreso: number
}

interface AsistenciaPais {
  pais: string
  tipo: string
  usuariosDistintos: number
  asistencias: number
  totalInscritos: number
}

interface RendimientoAdvisor {
  advisor: string
  agendados: number
  asistieron: number
  ausentes: number
  cancelados: number
  porcentajeAsistencia: number
}

interface UsuariosPais {
  pais: string
  activos: number
  inactivos: number
  total: number
}

interface ReporteData {
  filters: { startDate: string; endDate: string }
  resumenEventos: ResumenEvento[]
  complementarias: Complementarias
  asistenciaPorPais: AsistenciaPais[]
  rendimientoAdvisors: RendimientoAdvisor[]
  usuariosPorPais: UsuariosPais[]
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  color,
  onExport,
}: {
  title: string
  subtitle?: string
  color: string
  onExport: () => void
}) {
  return (
    <div className={`${color} rounded-t-lg px-6 py-4 flex items-center justify-between`}>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={onExport}
        title="Exportar CSV"
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
      >
        <DocumentArrowDownIcon className="h-4 w-4" />
        CSV
      </button>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  color: string
}) {
  return (
    <div className={`${color} rounded-lg p-4`}>
      <p className="text-xs font-medium text-white/80 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-white/70 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReporteGeneral() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const handleGenerar = async () => {
    if (!startDate || !endDate) {
      setError('Selecciona ambas fechas')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/postgres/reports/general?startDate=${startDate}&endDate=${endDate}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al generar el reporte')
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Derived totals ─────────────────────────────────────────────────────────
  const sesiones = data?.resumenEventos.find((r) => r.tipo === 'SESSION')
  const clubs = data?.resumenEventos.find((r) => r.tipo === 'CLUB')

  // Attendance by country — pivot SESSION and CLUB per pais
  const paisMap = new Map<
    string,
    { pais: string; sesiones: number; clubs: number; total: number }
  >()
  if (data) {
    for (const row of data.asistenciaPorPais) {
      if (!paisMap.has(row.pais)) {
        paisMap.set(row.pais, { pais: row.pais, sesiones: 0, clubs: 0, total: 0 })
      }
      const entry = paisMap.get(row.pais)!
      if (row.tipo === 'SESSION') entry.sesiones += row.asistencias
      if (row.tipo === 'CLUB') entry.clubs += row.asistencias
      entry.total += row.asistencias
    }
  }
  const asistenciaPaisPivot = Array.from(paisMap.values()).sort((a, b) => b.total - a.total)

  // ── CSV Exports ────────────────────────────────────────────────────────────
  const exportEventos = () => {
    if (!data) return
    exportToExcel(
      data.resumenEventos,
      [
        { header: 'Tipo', accessor: (r) => r.tipo },
        { header: 'Total Eventos', accessor: (r) => r.totalEventos },
        { header: 'Total Inscritos', accessor: (r) => r.totalInscritos },
        { header: 'Asistieron', accessor: (r) => r.asistieron },
        { header: 'Cancelados', accessor: (r) => r.cancelados },
      ],
      `reporte-eventos-${startDate}-${endDate}`
    )
  }

  const exportComplementarias = () => {
    if (!data) return
    exportToExcel(
      [data.complementarias],
      [
        { header: 'Total Solicitadas', accessor: (r) => r.totalSolicitadas },
        { header: 'Aprobadas', accessor: (r) => r.aprobadas },
        { header: 'Reprobadas', accessor: (r) => r.reprobadas },
        { header: 'En Progreso', accessor: (r) => r.enProgreso },
      ],
      `reporte-complementarias-${startDate}-${endDate}`
    )
  }

  const exportAsistenciaPais = () => {
    if (!data) return
    exportToExcel(
      asistenciaPaisPivot,
      [
        { header: 'País', accessor: (r) => r.pais },
        { header: 'Sesiones Asistidas', accessor: (r) => r.sesiones },
        { header: 'Clubs Asistidos', accessor: (r) => r.clubs },
        { header: 'Total Asistencias', accessor: (r) => r.total },
      ],
      `reporte-asistencia-pais-${startDate}-${endDate}`
    )
  }

  const exportAdvisors = () => {
    if (!data) return
    exportToExcel(
      data.rendimientoAdvisors,
      [
        { header: 'Advisor', accessor: (r) => r.advisor },
        { header: 'Agendados', accessor: (r) => r.agendados },
        { header: 'Asistieron', accessor: (r) => r.asistieron },
        { header: 'Ausentes', accessor: (r) => r.ausentes },
        { header: 'Cancelados', accessor: (r) => r.cancelados },
        { header: '% Asistencia', accessor: (r) => r.porcentajeAsistencia },
      ],
      `reporte-advisors-${startDate}-${endDate}`
    )
  }

  const exportUsuariosPais = () => {
    if (!data) return
    exportToExcel(
      data.usuariosPorPais,
      [
        { header: 'País', accessor: (r) => r.pais },
        { header: 'Activos', accessor: (r) => r.activos },
        { header: 'Inactivos', accessor: (r) => r.inactivos },
        { header: 'Total', accessor: (r) => r.total },
      ],
      `reporte-usuarios-pais-${startDate}-${endDate}`
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold text-gray-900">Reporte General</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tablero de gestión académica con métricas de eventos, asistencia y usuarios
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm pr-9"
              />
              <CalendarIcon className="absolute right-2.5 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm pr-9"
              />
              <CalendarIcon className="absolute right-2.5 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <button
            onClick={handleGenerar}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              'Generar Reporte'
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-4 py-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* ── Data sections ────────────────────────────────────────────────── */}
      {data && (
        <>
          {/* ── 1. Resumen de Eventos ─────────────────────────────────── */}
          <div className="shadow rounded-lg overflow-hidden">
            <SectionHeader
              title="Eventos"
              subtitle={`Sesiones y clubs realizados del ${startDate} al ${endDate}`}
              color="bg-blue-600"
              onExport={exportEventos}
            />
            <div className="bg-white p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Sesiones"
                value={sesiones?.totalEventos ?? 0}
                sub={`${sesiones?.asistieron ?? 0} con asistencia`}
                color="bg-blue-500"
              />
              <StatCard
                label="Clubs"
                value={clubs?.totalEventos ?? 0}
                sub={`${clubs?.asistieron ?? 0} con asistencia`}
                color="bg-cyan-500"
              />
              <StatCard
                label="Inscritos totales"
                value={(sesiones?.totalInscritos ?? 0) + (clubs?.totalInscritos ?? 0)}
                sub="sesiones + clubs"
                color="bg-violet-500"
              />
              <StatCard
                label="Total asistencias"
                value={(sesiones?.asistieron ?? 0) + (clubs?.asistieron ?? 0)}
                sub="sesiones + clubs"
                color="bg-emerald-500"
              />
            </div>
            {/* Detail table */}
            <div className="bg-white border-t border-gray-100 overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Tipo', 'Eventos', 'Inscritos', 'Asistieron', 'Cancelados', '% Asistencia'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.resumenEventos.map((r) => (
                    <tr key={r.tipo} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{r.tipo}</td>
                      <td className="px-4 py-2 text-gray-700">{r.totalEventos.toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-700">{r.totalInscritos.toLocaleString()}</td>
                      <td className="px-4 py-2 text-emerald-700 font-semibold">{r.asistieron.toLocaleString()}</td>
                      <td className="px-4 py-2 text-red-600">{r.cancelados.toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {r.totalInscritos > 0 ? Math.round((r.asistieron / r.totalInscritos) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 2. Complementarias ────────────────────────────────────── */}
          <div className="shadow rounded-lg overflow-hidden">
            <SectionHeader
              title="Actividades Complementarias"
              subtitle="Quiz IA solicitados en el período"
              color="bg-purple-600"
              onExport={exportComplementarias}
            />
            <div className="bg-white p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Solicitadas" value={data.complementarias.totalSolicitadas} color="bg-purple-500" />
              <StatCard label="Aprobadas" value={data.complementarias.aprobadas} sub="≥ 50% score" color="bg-emerald-500" />
              <StatCard label="Reprobadas" value={data.complementarias.reprobadas} color="bg-red-500" />
              <StatCard label="En Progreso" value={data.complementarias.enProgreso} color="bg-amber-500" />
            </div>
          </div>

          {/* ── 3. Asistencia por País ────────────────────────────────── */}
          <div className="shadow rounded-lg overflow-hidden">
            <SectionHeader
              title="Asistencia por País"
              subtitle="Usuarios que asistieron a sesiones y clubs, discriminado por plataforma"
              color="bg-teal-600"
              onExport={exportAsistenciaPais}
            />
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['País', 'Sesiones asistidas', 'Clubs asistidos', 'Total asistencias'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {asistenciaPaisPivot.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin datos</td></tr>
                  )}
                  {asistenciaPaisPivot.map((r) => (
                    <tr key={r.pais} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{r.pais}</td>
                      <td className="px-4 py-2 text-gray-700">{r.sesiones.toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-700">{r.clubs.toLocaleString()}</td>
                      <td className="px-4 py-2 font-semibold text-teal-700">{r.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {asistenciaPaisPivot.length > 0 && (
                    <tr className="bg-gray-50 font-semibold text-gray-700">
                      <td className="px-4 py-2">TOTAL</td>
                      <td className="px-4 py-2">{asistenciaPaisPivot.reduce((s, r) => s + r.sesiones, 0).toLocaleString()}</td>
                      <td className="px-4 py-2">{asistenciaPaisPivot.reduce((s, r) => s + r.clubs, 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-teal-700">{asistenciaPaisPivot.reduce((s, r) => s + r.total, 0).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 4. Rendimiento por Advisor ───────────────────────────── */}
          <div className="shadow rounded-lg overflow-hidden">
            <SectionHeader
              title="Rendimiento por Advisor"
              subtitle="Clases agendadas, asistencias y ausencias — ordenado de mayor a menor"
              color="bg-orange-600"
              onExport={exportAdvisors}
            />
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Advisor', 'Agendados', 'Asistieron', 'Ausentes', 'Cancelados', '% Asistencia'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.rendimientoAdvisors.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin datos</td></tr>
                  )}
                  {data.rendimientoAdvisors.map((r) => (
                    <tr key={r.advisor} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{r.advisor}</td>
                      <td className="px-4 py-2 text-gray-700">{r.agendados.toLocaleString()}</td>
                      <td className="px-4 py-2 text-emerald-700 font-semibold">{r.asistieron.toLocaleString()}</td>
                      <td className="px-4 py-2 text-red-600">{r.ausentes.toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-500">{r.cancelados.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                            <div
                              className="bg-orange-500 h-1.5 rounded-full"
                              style={{ width: `${r.porcentajeAsistencia}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-9 text-right">{r.porcentajeAsistencia}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 5. Usuarios por País ──────────────────────────────────── */}
          <div className="shadow rounded-lg overflow-hidden">
            <SectionHeader
              title="Usuarios Académicos por País"
              subtitle="Estado actual de beneficiarios activos e inactivos por plataforma"
              color="bg-rose-600"
              onExport={exportUsuariosPais}
            />
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['País', 'Activos', 'Inactivos', 'Total', '% Activos'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.usuariosPorPais.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin datos</td></tr>
                  )}
                  {data.usuariosPorPais.map((r) => (
                    <tr key={r.pais} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{r.pais}</td>
                      <td className="px-4 py-2 text-emerald-700 font-semibold">{r.activos.toLocaleString()}</td>
                      <td className="px-4 py-2 text-red-600">{r.inactivos.toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-700">{r.total.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${r.total > 0 ? Math.round((r.activos / r.total) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-9 text-right">
                            {r.total > 0 ? Math.round((r.activos / r.total) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.usuariosPorPais.length > 0 && (
                    <tr className="bg-gray-50 font-semibold text-gray-700">
                      <td className="px-4 py-2">TOTAL</td>
                      <td className="px-4 py-2 text-emerald-700">{data.usuariosPorPais.reduce((s, r) => s + r.activos, 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-red-600">{data.usuariosPorPais.reduce((s, r) => s + r.inactivos, 0).toLocaleString()}</td>
                      <td className="px-4 py-2">{data.usuariosPorPais.reduce((s, r) => s + r.total, 0).toLocaleString()}</td>
                      <td className="px-4 py-2" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
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
