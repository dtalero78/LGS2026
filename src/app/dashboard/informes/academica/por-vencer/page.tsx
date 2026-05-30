'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowDownTrayIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { InformesPermission } from '@/types/permissions'

type Tipo = 'titular' | 'beneficiario'

interface RowBase {
  _id: string
  nombre: string
  numeroId: string
  contrato: string
  plataforma: string | null
  email: string | null
  celular: string | null
  finalContrato: string | null
  diasRestantes: number | null
}
interface RowTitular extends RowBase { beneficiarios: number }
interface RowBeneficiario extends RowBase {
  onHoldCount: number
  extensionCount: number
  academicaId: string | null
}

interface Data {
  tipo: Tipo
  rango: { startDate: string | null; endDate: string | null }
  rows: (RowTitular | RowBeneficiario)[]
  total: number
  capped: boolean
  maxRows: number
  conHold: number
  conExtension: number
}

// Default dates: hoy → hoy + 1 mes (ventana móvil de 30 días)
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const oneMonthFromTodayStr = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PorVencerPage() {
  const [tipo, setTipo]           = useState<Tipo>('titular')
  const [search, setSearch]       = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate]     = useState(oneMonthFromTodayStr())
  const [hold, setHold]           = useState<'todos' | 'con' | 'sin'>('todos')
  const [extension, setExtension] = useState<'todos' | 'con' | 'sin'>('todos')
  const [data, setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]  = useState<string | null>(null)

  const fetchData = useCallback(async (
    t: Tipo, q: string, sd: string, ed: string, h: string, ex: string
  ) => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams({ tipo: t })
      if (q) qs.set('search', q)
      if (sd) qs.set('startDate', sd)
      if (ed) qs.set('endDate', ed)
      if (t === 'beneficiario') { qs.set('hold', h); qs.set('extension', ex) }
      const res = await fetch(`/api/postgres/reports/academica/por-vencer?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar datos')
      setData(json)
    } catch (e: any) { setError(e.message || 'Error inesperado') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(tipo, '', startDate, endDate, hold, extension) }, [fetchData]) // eslint-disable-line

  const handleApply = () => fetchData(tipo, search, startDate, endDate, hold, extension)
  const handleClear = () => {
    setSearch(''); setStartDate(todayStr()); setEndDate(oneMonthFromTodayStr())
    setHold('todos'); setExtension('todos')
    fetchData(tipo, '', todayStr(), oneMonthFromTodayStr(), 'todos', 'todos')
  }
  const switchTipo = (t: Tipo) => {
    setTipo(t)
    fetchData(t, search, startDate, endDate, hold, extension)
  }

  const handleCSV = () => {
    if (!data?.rows.length) return
    if (tipo === 'titular') {
      exportToExcel(data.rows as RowTitular[], [
        { header: 'Titular',           accessor: r => r.nombre },
        { header: 'ID',                accessor: r => r.numeroId ?? '' },
        { header: 'Contrato',          accessor: r => r.contrato ?? '' },
        { header: 'Plataforma',        accessor: r => r.plataforma ?? '' },
        { header: 'Email',             accessor: r => r.email ?? '' },
        { header: 'Celular',           accessor: r => r.celular ?? '' },
        { header: '# Beneficiarios',   accessor: r => r.beneficiarios },
        { header: 'Fecha vencimiento', accessor: r => r.finalContrato ?? '' },
        { header: 'Días restantes',    accessor: r => r.diasRestantes ?? '' },
      ], `por-vencer_titulares_${startDate}_${endDate}`)
    } else {
      exportToExcel(data.rows as RowBeneficiario[], [
        { header: 'Beneficiario',      accessor: r => r.nombre },
        { header: 'ID',                accessor: r => r.numeroId ?? '' },
        { header: 'Contrato',          accessor: r => r.contrato ?? '' },
        { header: 'Plataforma',        accessor: r => r.plataforma ?? '' },
        { header: 'Email',             accessor: r => r.email ?? '' },
        { header: 'Celular',           accessor: r => r.celular ?? '' },
        { header: 'Holds (#)',         accessor: r => r.onHoldCount },
        { header: 'Extensiones (#)',   accessor: r => r.extensionCount },
        { header: 'Fecha vencimiento', accessor: r => r.finalContrato ?? '' },
        { header: 'Días restantes',    accessor: r => r.diasRestantes ?? '' },
      ], `por-vencer_beneficiarios_${startDate}_${endDate}`)
    }
  }

  const diasColor = (d: number | null): string => {
    if (d == null) return 'text-gray-500'
    if (d <= 7) return 'text-red-600 font-semibold'
    if (d <= 30) return 'text-orange-600 font-medium'
    return 'text-gray-700'
  }

  const rows = data?.rows ?? []
  const verHref = (r: any) => {
    if (tipo === 'titular') return `/person/${r._id}`
    // beneficiario: si tiene academicaId, /student; si no, fallback /person.
    if (r.academicaId) return `/student/${r.academicaId}`
    return `/person/${r._id}`
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ClockIcon className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Por Vencer</h1>
            <p className="text-sm text-gray-500">Contratos con <code className="text-xs px-1 bg-gray-100 rounded">finalContrato</code> dentro del rango. Aprobados, activos, no finalizados. Default: hoy → hoy + 1 mes.</p>
          </div>
        </div>

        {/* Tabs Titular / Beneficiario */}
        <div className="flex gap-2 border-b border-gray-200">
          <button type="button" onClick={() => switchTipo('titular')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tipo === 'titular'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>Titulares</button>
          <button type="button" onClick={() => switchTipo('beneficiario')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tipo === 'beneficiario'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>Beneficiarios</button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="pv-search" className="block text-xs text-gray-500 mb-1">Buscar (nombre / ID / contrato)</label>
              <input id="pv-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ej: 01-15194"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="pv-start" className="block text-xs text-gray-500 mb-1">Fecha inicial</label>
              <input id="pv-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="pv-end" className="block text-xs text-gray-500 mb-1">Fecha final</label>
              <input id="pv-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {tipo === 'beneficiario' && (
              <>
                <div>
                  <label htmlFor="pv-hold" className="block text-xs text-gray-500 mb-1">Hold</label>
                  <select id="pv-hold" value={hold} onChange={e => setHold(e.target.value as any)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[110px]">
                    <option value="todos">Todos</option>
                    <option value="con">Con</option>
                    <option value="sin">Sin</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pv-ext" className="block text-xs text-gray-500 mb-1">Extensión</label>
                  <select id="pv-ext" value={extension} onChange={e => setExtension(e.target.value as any)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[110px]">
                    <option value="todos">Todos</option>
                    <option value="con">Con</option>
                    <option value="sin">Sin</option>
                  </select>
                </div>
              </>
            )}
            <div className="flex gap-2 ml-auto flex-wrap">
              <button type="button" onClick={handleApply} disabled={loading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">Aplicar filtro</button>
              <button type="button" onClick={handleClear} disabled={loading}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Limpiar</button>
              <button type="button" onClick={handleApply}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"><ArrowPathIcon className="h-4 w-4" />Recargar</button>
              <PermissionGuard permission={InformesPermission.ACAD_POR_VENCER_EXP}>
                <button type="button" onClick={handleCSV} disabled={loading || !rows.length}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  <ArrowDownTrayIcon className="h-4 w-4" /> Descargar CSV
                </button>
              </PermissionGuard>
            </div>
          </div>
        </div>

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}
            <button type="button" onClick={handleApply} className="ml-4 text-xs underline">Reintentar</button></div>
        )}

        {/* Cabecera contador */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{tipo === 'titular' ? 'Titulares' : 'Beneficiarios'} por vencer</p>
            <p className="text-3xl font-bold text-gray-900">{(data?.total ?? 0).toLocaleString()}</p>
          </div>
          {tipo === 'beneficiario' && (
            <>
              <div className="border-l border-gray-200 pl-4">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Con Hold</p>
                <p className="text-2xl font-bold text-amber-700">{data?.conHold ?? 0}</p>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Con Extensión</p>
                <p className="text-2xl font-bold text-emerald-700">{data?.conExtension ?? 0}</p>
              </div>
            </>
          )}
          <p className="text-[11px] text-gray-400 ml-auto">{startDate} → {endDate}</p>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Detalle</h3>
            <p className="text-xs text-gray-400">
              {(rows.length).toLocaleString()} filas
              {data?.capped && <span className="text-amber-600"> · mostrando {data.maxRows.toLocaleString()} máx · afina filtros o usa CSV</span>}
            </p>
          </div>
          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" /><p className="text-sm text-gray-400">Cargando…</p></div>
          ) : !rows.length ? (
            <p className="p-8 text-center text-sm text-gray-400">Sin {tipo === 'titular' ? 'titulares' : 'beneficiarios'} por vencer en este rango.</p>
          ) : (
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{tipo === 'titular' ? 'Titular' : 'Beneficiario'}</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Contrato</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Contacto</th>
                    {tipo === 'titular' ? (
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide"># Benef</th>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Hold</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Extensión</th>
                      </>
                    )}
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Fecha vencimiento</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Días rest.</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, idx) => {
                    const rb = r as RowBeneficiario
                    const rt = r as RowTitular
                    return (
                      <tr key={`${r._id}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 whitespace-nowrap">{r.nombre || '—'}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{r.numeroId ?? ''} · {r.plataforma ?? ''}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded">{r.contrato}</span></td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {r.email && <div className="truncate max-w-[200px]" title={r.email}>{r.email}</div>}
                          {r.celular && <div className="text-gray-500">{r.celular}</div>}
                        </td>
                        {tipo === 'titular' ? (
                          <td className="px-3 py-2 text-center text-gray-700">{rt.beneficiarios}</td>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-center">
                              {(rb.onHoldCount || 0) > 0
                                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">{rb.onHoldCount}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {(rb.extensionCount || 0) > 0
                                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">{rb.extensionCount}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.finalContrato ? new Date(r.finalContrato).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : '—'}</td>
                        <td className={`px-3 py-2 text-center ${diasColor(r.diasRestantes)}`}>
                          {r.diasRestantes != null ? `${r.diasRestantes}d` : '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <a href={verHref(r)} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium">
                            Ver ↗
                          </a>
                        </td>
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
