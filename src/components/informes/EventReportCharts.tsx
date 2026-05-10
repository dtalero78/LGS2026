'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, Legend,
} from 'recharts'
import type { ChartsData, ReportConfig } from './event-report.types'
import { TYPE_COLORS } from './event-report.config'

interface Props {
  charts: ChartsData
  config: ReportConfig
  loading: boolean
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Heatmap custom component ──────────────────────────────────────────────────
const DAYS_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function Heatmap({ data }: { data: { dia: string; hora: string; total: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>

  const dias  = DAYS_ORDER.filter(d => data.some(r => r.dia === d))
  const horas = [...new Set(data.map(r => r.hora))].sort()
  const maxVal = Math.max(...data.map(r => r.total), 1)

  const getVal = (dia: string, hora: string) =>
    data.find(r => r.dia === dia && r.hora === hora)?.total ?? 0

  const getColor = (val: number) => {
    if (val === 0) return '#f3f4f6'
    const intensity = Math.ceil((val / maxVal) * 5)
    const palette = ['#ede9fe', '#c4b5fd', '#a78bfa', '#7c3aed', '#4c1d95']
    return palette[Math.min(intensity - 1, 4)]
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="p-1 text-gray-400 font-normal w-10" />
            {horas.map(h => (
              <th key={h} className="p-1 text-gray-500 font-medium text-center" style={{ minWidth: 36 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map(dia => (
            <tr key={dia}>
              <td className="p-1 text-gray-500 font-medium pr-2">{dia}</td>
              {horas.map(hora => {
                const val = getVal(dia, hora)
                return (
                  <td key={hora} title={`${dia} ${hora}: ${val}`}
                    className="p-0.5 text-center rounded cursor-default"
                    style={{ backgroundColor: getColor(val), color: val > 0 ? '#4b5563' : 'transparent' }}>
                    <span className="block text-[10px] font-medium leading-5 w-8 h-5 mx-auto">{val || ''}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EventReportCharts({ charts, config, loading }: Props) {
  if (loading) return <LoadingSkeleton />

  const noData = (arr: unknown[]) => arr.length === 0
    ? <p className="text-sm text-gray-400 text-center py-8">Sin datos para el período</p>
    : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      {/* 1. Eventos por Tipo */}
      <ChartCard title="Eventos por Tipo">
        {noData(charts.eventosPorTipo) ?? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.eventosPorTipo} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v, 'Eventos']} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {charts.eventosPorTipo.map(e => (
                  <Cell key={e.name} fill={TYPE_COLORS[e.name] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 2. Eventos por Nivel */}
      <ChartCard title="Eventos por Nivel">
        {noData(charts.eventosPorNivel) ?? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.eventosPorNivel.slice(0, 12)} layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v: number) => [v, 'Eventos']} />
              <Bar dataKey="total" fill={Object.values(config.colors)[0] ?? '#6366f1'} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 3. Eventos por Hora */}
      <ChartCard title="Eventos por Hora">
        {noData(charts.eventosPorHora) ?? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.eventosPorHora} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v, 'Eventos']} />
              <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 4. Asistencia vs Inscritos */}
      <ChartCard title="Asistencia vs Inscritos (por fecha)">
        {noData(charts.asistenciaVsInscritos) ?? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={charts.asistenciaVsInscritos.slice(-30)}
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="gradInscritos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAsistentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="fecha" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="inscritos"  name="Inscritos"
                stroke="#6366f1" fill="url(#gradInscritos)"  strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="asistentes" name="Asistentes"
                stroke="#10b981" fill="url(#gradAsistentes)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 5. Ranking Advisors */}
      <ChartCard title="Ranking Advisors por Eventos">
        {noData(charts.rankingAdvisors) ?? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.rankingAdvisors.slice(0, 10)} layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80}
                tickFormatter={v => v.length > 14 ? `${v.slice(0, 13)}…` : v} />
              <Tooltip formatter={(v: number) => [v, 'Eventos']} />
              <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 6. Heatmap Día vs Hora */}
      <ChartCard title="Heatmap — Día vs Hora">
        <Heatmap data={charts.heatmapDiaHora} />
      </ChartCard>

    </div>
  )
}
