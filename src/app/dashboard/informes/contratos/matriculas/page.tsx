'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ArrowPathIcon, DocumentCheckIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface MatriculasData {
  cards: {
    xAprobar: number; vigentes: number; finalizados: number
    beneficiarios: number; academicosActivos: number; academicosInactivos: number
  }
  barPendientes: { name: string; value: number }[]
  donut: { name: string; value: number }[]
  heatmap: { year: number; paises: string[]; data: { pais: string; mes: number; n: number }[] }
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const BAR_COLORS = ['#fbbf24', '#f97316', '#ef4444']
const DONUT_COLORS: Record<string, string> = {
  'aprobadas (sin finalizar)': '#22c55e',
  'sin aprobar': '#f59e0b',
}

function Card({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
  const r = 55, cx = 70, cy = 70, sw = 22, circ = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
        {data.map((seg, i) => {
          const pct = seg.value / total
          const dash = pct * circ
          const rot = offset * 360 - 90
          offset += pct
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={DONUT_COLORS[seg.name.toLowerCase()] ?? '#9ca3af'} strokeWidth={sw}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="butt"
            transform={`rotate(${rot} ${cx} ${cy})`} />
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1f2937">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b7280">MATRÍCULAS</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[seg.name.toLowerCase()] ?? '#9ca3af' }} />
            <span className="text-gray-600 w-36">{seg.name}</span>
            <span className="font-semibold text-gray-900 w-12 text-right">{seg.value.toLocaleString()}</span>
            <span className="text-gray-400">{((seg.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MatriculasPage() {
  const [data, setData] = useState<MatriculasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/postgres/reports/contratos/matriculas', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar datos')
      setData({ cards: json.cards, barPendientes: json.barPendientes, donut: json.donut, heatmap: json.heatmap })
    } catch (e: any) { setError(e.message || 'Error inesperado') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const c = data?.cards
  const heatMax = useMemo(() => Math.max(1, ...(data?.heatmap.data ?? []).map(d => d.n)), [data])
  const heatLookup = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of data?.heatmap.data ?? []) m.set(`${d.pais}-${d.mes}`, d.n)
    return m
  }, [data])
  const heatColor = (v: number) => {
    if (v <= 0) return '#f8fafc'
    const t = v / heatMax
    // interpolar #dbeafe -> #1d4ed8
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
    const r = mix(0xdb, 0x1d), g = mix(0xea, 0x4e), b = mix(0xfe, 0xd8)
    return `rgb(${r},${g},${b})`
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DocumentCheckIcon className="h-7 w-7 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Matrículas</h1>
              <p className="text-sm text-gray-500">Estado de contratos: por aprobar, vigentes, finalizados y usuarios académicos.</p>
            </div>
          </div>
          <button type="button" onClick={fetchData}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
            <ArrowPathIcon className="h-4 w-4" /> Recargar
          </button>
        </div>

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}<button type="button" onClick={fetchData} className="ml-4 text-xs underline">Reintentar</button>
          </div>
        )}

        {/* Tarjetas — fila 1: contratos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card label="Contratos x Aprobar" value={c?.xAprobar ?? 0} color="#f59e0b" hint="Titulares pendientes de aprobación" />
          <Card label="Contratos Vigentes" value={c?.vigentes ?? 0} color="#22c55e" hint="Aprobados, no finalizados" />
          <Card label="Contratos Finalizados" value={c?.finalizados ?? 0} color="#ef4444" hint="Estado FINALIZADA" />
        </div>
        {/* Tarjetas — fila 2: personas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card label="Beneficiarios" value={c?.beneficiarios ?? 0} color="#3b82f6" hint="De titulares vigentes" />
          <Card label="Académicos Activos" value={c?.academicosActivos ?? 0} color="#0ea5e9" hint="Step 0–49, contrato no finalizado" />
          <Card label="Académicos Inactivos" value={c?.academicosInactivos ?? 0} color="#9ca3af" hint="Step 50 (DONE)" />
        </div>

        {/* Barras (pendientes por antigüedad) + Dona (aprobadas vs sin aprobar) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Matrículas pendientes por antigüedad</h3>
            <p className="text-xs text-gray-400 mb-4">Titulares sin aprobar según el tiempo transcurrido</p>
            {loading ? (
              <div className="h-56 bg-gray-100 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.barPendientes ?? []} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, 'Titulares']} />
                  <Bar dataKey="value" name="Titulares" radius={[4, 4, 0, 0]}>
                    {(data?.barPendientes ?? []).map((_d, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Aprobadas vs Sin aprobar</h3>
            {loading ? <div className="h-48 bg-gray-100 rounded animate-pulse" /> : <DonutChart data={data?.donut ?? []} />}
          </div>
        </div>

        {/* Heatmap matrículas aprobadas por país × mes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Matrículas aprobadas por país y mes</h3>
          <p className="text-xs text-gray-400 mb-4">Año {data?.heatmap.year ?? ''} — mes de inicio del contrato</p>
          {loading ? (
            <div className="h-40 bg-gray-100 rounded animate-pulse" />
          ) : !(data?.heatmap.paises.length) ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className="text-left font-medium text-gray-400 pr-2 sticky left-0 bg-white">País</th>
                    {MESES.map(m => <th key={m} className="font-medium text-gray-400 w-9 text-center">{m}</th>)}
                    <th className="font-semibold text-gray-500 w-12 text-center pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.heatmap.paises.map(pais => {
                    const rowTotal = MESES.reduce((s, _m, i) => s + (heatLookup.get(`${pais}-${i + 1}`) ?? 0), 0)
                    return (
                      <tr key={pais}>
                        <td className="pr-2 text-gray-700 whitespace-nowrap sticky left-0 bg-white">{pais}</td>
                        {MESES.map((_m, i) => {
                          const v = heatLookup.get(`${pais}-${i + 1}`) ?? 0
                          return (
                            <td key={i} className="w-9 h-9 text-center align-middle rounded"
                              style={{ backgroundColor: heatColor(v), color: v / heatMax > 0.55 ? '#fff' : '#374151' }}
                              title={`${pais} · ${MESES[i]}: ${v}`}>
                              {v > 0 ? v : ''}
                            </td>
                          )
                        })}
                        <td className="w-12 text-center font-semibold text-gray-700 pl-2">{rowTotal.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
