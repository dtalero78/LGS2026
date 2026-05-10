'use client'

import type { KpiData, ReportConfig } from './event-report.types'

interface Props {
  kpis:     KpiData
  config:   ReportConfig
  loading:  boolean
}

function KpiCard({ label, value, color, sub }: {
  label: string; value: string | number; color: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function EventReportKpis({ kpis, config, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  const firstColor = Object.values(config.colors)[0] ?? '#6b7280'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* KPIs per type */}
      {config.kpiLabels.map(({ key, label }) => (
        <KpiCard
          key={key}
          label={label}
          value={(kpis.totalPorTipo[key] ?? 0).toLocaleString()}
          color={config.colors[key] ?? firstColor}
        />
      ))}

      <KpiCard label="Total Inscritos"  value={kpis.totalInscritos.toLocaleString()}  color="#6366f1" />
      <KpiCard label="Total Asistentes" value={kpis.totalAsistentes.toLocaleString()} color="#10b981" />
      <KpiCard label="% Asistencia"     value={`${kpis.pctAsistencia}%`}              color="#f59e0b"
        sub="asistentes / inscritos" />
      <KpiCard label="% Ocupación"      value={`${kpis.pctOcupacion}%`}               color="#8b5cf6"
        sub="inscritos / capacidad" />
    </div>
  )
}
