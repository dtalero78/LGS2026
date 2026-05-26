'use client'

/**
 * Visualizaciones globales del mes corriente para el dashboard admin
 * (cualquier rol NO-ADVISOR):
 *   1. Heatmap Día × Hora con todos los agendamientos del mes
 *   2. Donut con 3 buckets disjuntos: Asistieron / Canceladas / No asistieron
 *   3. Barras horizontales con sesiones agendadas por nivel
 *
 * Datos: `/api/postgres/dashboard/monthly?tz=...` (3 queries paralelas en
 * dashboard.service.getMonthlyAggregates). Caché client-side via React Query
 * (staleTime 5min, refetchInterval 10min) — mismo patrón que DashboardStats.
 */

import { useMemo } from 'react'
import { useQuery } from 'react-query'

interface MonthlyData {
  heatmap: { weekday: number; hour: number; total: number }[]
  donut: { asistieron: number; canceladas: number; noAsistieron: number }
  porNivel: { nivel: string; total: number }[]
  monthLabel: string
}

const WEEKDAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

function clientTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota' }
  catch { return 'America/Bogota' }
}

export default function DashboardMonthlyCharts() {
  const { data, isLoading, error } = useQuery<MonthlyData>(
    'dashboard-monthly',
    async () => {
      const r = await fetch(`/api/postgres/dashboard/monthly?tz=${encodeURIComponent(clientTz())}`)
      const j = await r.json()
      if (!j.success) throw new Error(j.error || 'Error cargando agregados mensuales')
      return { heatmap: j.heatmap, donut: j.donut, porNivel: j.porNivel, monthLabel: j.monthLabel }
    },
    { staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000 },
  )

  // Matriz 7×16 para el heatmap (default 0)
  const matrix = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(HOURS.length).fill(0)) as number[][]
    data?.heatmap.forEach(r => {
      const hi = HOURS.indexOf(r.hour)
      if (hi >= 0 && r.weekday >= 0 && r.weekday <= 6) m[r.weekday][hi] = r.total
    })
    return m
  }, [data])
  const matrixMax = useMemo(() => matrix.flat().reduce((a, b) => Math.max(a, b), 0), [matrix])

  const nivelMax = useMemo(
    () => data?.porNivel.reduce((m, r) => Math.max(m, r.total), 0) ?? 0,
    [data],
  )

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        Cargando agregados del mes…
      </div>
    )
  }
  if (error || !data) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">No se pudo cargar la información del mes.</div>
  }

  const totalDonut = data.donut.asistieron + data.donut.canceladas + data.donut.noAsistieron

  return (
    <div className="space-y-4">
      {/* Heatmap del mes — ancho completo */}
      <DayHourHeatmap
        title="Agendamientos del mes — Día vs Hora"
        subtitle={data.monthLabel}
        matrix={matrix}
        max={matrixMax}
      />

      {/* Donut + barras por nivel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DonutCard
          title="Sesiones del mes"
          subtitle={data.monthLabel}
          total={totalDonut}
          segments={[
            { label: 'Asistieron',    value: data.donut.asistieron,   color: '#22c55e' },
            { label: 'No asistieron', value: data.donut.noAsistieron, color: '#f97316' },
            { label: 'Canceladas',    value: data.donut.canceladas,   color: '#ef4444' },
          ]}
        />
        <NivelBarChart
          title="Sesiones agendadas por nivel"
          subtitle={data.monthLabel}
          items={data.porNivel}
          max={nivelMax}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Heatmap Día × Hora (mismo patrón usado en AdvisorDashboard)
// ────────────────────────────────────────────────────────────────────────

function DayHourHeatmap({ title, subtitle, matrix, max }: {
  title: string
  subtitle: string
  matrix: number[][]
  max: number
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-500 capitalize">{subtitle}</span>
      </div>
      {max === 0 ? (
        <div className="flex items-center justify-center min-h-[180px] text-sm text-gray-400">
          Sin agendamientos para este mes
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-[10px] mx-auto">
            <thead>
              <tr>
                <th className="w-8"><span className="sr-only">Día</span></th>
                {HOURS.map(h => (
                  <th key={h} className="w-7 text-center font-medium text-gray-500">
                    {String(h).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS_ES.map((dayLabel, wd) => (
                <tr key={dayLabel}>
                  <td className="pr-1 text-right font-medium text-gray-500">{dayLabel}</td>
                  {HOURS.map((h, hIdx) => {
                    const v = matrix[wd][hIdx]
                    const bg = scaleColor(v, max, '#1d4ed8', '#dbeafe')
                    return (
                      <td
                        key={h}
                        className="w-7 h-7 text-center align-middle rounded border border-gray-100"
                        style={bg ? { backgroundColor: bg } : undefined}
                        title={`${dayLabel} ${String(h).padStart(2, '0')}:00 — ${v} agendamiento(s)`}
                      >
                        <span className={v >= Math.ceil(max * 0.6) ? 'text-white font-semibold' : 'text-gray-700'}>
                          {v || ''}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Donut SVG (mismo patrón que welcome-session/page.tsx + AdvisorDashboard)
// ────────────────────────────────────────────────────────────────────────

function DonutCard({ title, subtitle, total, segments }: {
  title: string
  subtitle: string
  total: number
  segments: { label: string; value: number; color: string }[]
}) {
  const r = 60, cx = 75, cy = 75, sw = 24
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-500 capitalize">{subtitle}</span>
      </div>
      {total === 0 ? (
        <div className="flex items-center justify-center h-[150px] text-sm text-gray-400">
          Sin datos para este mes
        </div>
      ) : (
        <div className="flex items-center gap-6 flex-wrap">
          <svg width="150" height="150" viewBox="0 0 150 150">
            {segments.map((seg, i) => {
              if (!seg.value) return null
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
            })}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1f2937">
              {total.toLocaleString()}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#6b7280">TOTAL</text>
          </svg>

          <div className="space-y-2 flex-1 min-w-[180px]">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-gray-600 flex-1">{seg.label}</span>
                <span className="font-semibold text-gray-900 w-12 text-right">{seg.value.toLocaleString()}</span>
                <span className="text-gray-400 text-xs w-12 text-right">
                  {total > 0 ? `${((seg.value / total) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Barras horizontales por nivel con etiquetas (sin Recharts — CSS puro)
// ────────────────────────────────────────────────────────────────────────

function NivelBarChart({ title, subtitle, items, max }: {
  title: string
  subtitle: string
  items: { nivel: string; total: number }[]
  max: number
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-500 capitalize">{subtitle}</span>
      </div>
      {items.length === 0 || max === 0 ? (
        <div className="flex items-center justify-center h-[150px] text-sm text-gray-400">
          Sin sesiones agendadas este mes
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(it => {
            const pct = Math.max(1, (it.total / max) * 100)
            return (
              <div key={it.nivel} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-right font-medium text-gray-700 truncate" title={it.nivel}>
                  {it.nivel}
                </span>
                <div className="flex-1 bg-gray-100 rounded h-5 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500 rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-left font-semibold text-gray-900 tabular-nums">
                  {it.total.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Helpers de color (mismo patrón en AdvisorDashboard)
// ────────────────────────────────────────────────────────────────────────

function scaleColor(value: number, max: number, dark: string, light: string): string | null {
  if (!value || !max) return null
  const t = Math.max(0.15, value / max)
  return mixHex(light, dark, t)
}

function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b)
  const r = Math.round(pa.r + (pb.r - pa.r) * t)
  const g = Math.round(pa.g + (pb.g - pa.g) * t)
  const bl = Math.round(pa.b + (pb.b - pa.b) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  }
}
