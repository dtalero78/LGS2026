'use client'

import { useState, useCallback, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import EventReportFilters from './EventReportFilters'
import EventReportKpis    from './EventReportKpis'
import EventReportCharts  from './EventReportCharts'
import EventReportTable   from './EventReportTable'
import { REPORT_CONFIGS }  from './event-report.config'
import type { ReportType, ReportResponse, FilterState } from './event-report.types'

const today       = new Date().toISOString().substring(0, 10)
const firstOfYear = `${new Date().getFullYear()}-01-01`

const DEFAULT_FILTERS: FilterState = {
  fechaInicio:   firstOfYear,
  fechaFin:      today,
  nivel:         '',
  hora:          '',
  advisorNombre: '',
  tipoClub:      '',
}

interface Props { reportType: ReportType }

export default function EventReportPage({ reportType }: Props) {
  const config = REPORT_CONFIGS[reportType]

  const [filters,  setFilters]  = useState<FilterState>(DEFAULT_FILTERS)
  const [data,     setData]     = useState<ReportResponse | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetchData = useCallback(async (f: FilterState) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        reportType,
        fechaInicio:   f.fechaInicio,
        fechaFin:      f.fechaFin,
        nivel:         f.nivel,
        hora:          f.hora,
        advisorNombre: f.advisorNombre,
        tipoClub:      f.tipoClub,
      })
      const res  = await fetch(`/api/postgres/reports/programacion/eventos-informe?${qs}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al cargar datos')
      setData(json.data ?? json)
    } catch (e: any) {
      setError(e.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [reportType])

  useEffect(() => { fetchData(DEFAULT_FILTERS) }, [fetchData])

  const handleApply = () => fetchData(filters)
  const handleClear = () => {
    setFilters(DEFAULT_FILTERS)
    fetchData(DEFAULT_FILTERS)
  }

  const emptyMeta = { niveles: [], horas: [], advisors: [] }
  const meta      = data?.meta ?? emptyMeta

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{config.subtitle}</p>
        </div>

        {/* Filters */}
        <EventReportFilters
          filters={filters}
          onChange={setFilters}
          onApply={handleApply}
          onClear={handleClear}
          onExport={() => {/* handled inside table */}}
          showTipoClubFilter={config.showTipoClubFilter}
          niveles={meta.niveles}
          horas={meta.horas}
          advisors={meta.advisors}
          loading={loading}
        />

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
            <button type="button" onClick={handleApply} className="ml-auto text-xs underline hover:no-underline">Reintentar</button>
          </div>
        )}

        {/* KPIs */}
        <EventReportKpis
          kpis={data?.kpis ?? { totalEventos: 0, totalPorTipo: {}, totalInscritos: 0, totalAsistentes: 0, totalCapacidad: 0, pctAsistencia: 0, pctOcupacion: 0 }}
          config={config}
          loading={loading}
        />

        {/* Charts */}
        <EventReportCharts
          charts={data?.charts ?? { eventosPorTipo: [], eventosPorNivel: [], eventosPorHora: [], asistenciaVsInscritos: [], rankingAdvisors: [], heatmapDiaHora: [] }}
          config={config}
          loading={loading}
        />

        {/* Table */}
        <EventReportTable
          data={data?.table ?? []}
          config={config}
          loading={loading}
          filters={{ fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin }}
        />

      </div>
    </DashboardLayout>
  )
}
