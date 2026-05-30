'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowDownTrayIcon, ArrowPathIcon, BeakerIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { MantenimientoPermission } from '@/types/permissions'

interface Row {
  titularId: string
  contrato: string
  nombre: string
  numeroId: string
  plataforma: string | null
  email: string | null
  asesor: string | null
  fechaContrato: string | null
  beneficiarios: number
}

interface Data {
  rows: Row[]
  plataformas: string[]
  total: number
}

interface PurgeResultItem {
  contrato: string
  status: 'ok' | 'error' | 'not_test'
  error?: string
  borrados?: {
    people: number; academica: number; bookings: number; financieros: number
    pagos: number; stepOverrides: number; complementarias: number; usuariosRoles: number
  }
}

export default function ContratosPruebaPage() {
  const [search, setSearch] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())   // por `contrato`
  const [purgeModal, setPurgeModal] = useState<{ open: boolean; motivo: string; confirm: boolean; saving: boolean }>({ open: false, motivo: '', confirm: false, saving: false })
  const [purgeResult, setPurgeResult] = useState<{ ok: number; failed: number; total: number; results: PurgeResultItem[] } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (plataforma) qs.set('plataforma', plataforma)
      if (fechaDesde) qs.set('fechaDesde', fechaDesde)
      if (fechaHasta) qs.set('fechaHasta', fechaHasta)
      const res = await fetch(`/api/admin/contratos-prueba/list?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar')
      setData(json)
      // limpiar selección que ya no esté en pantalla
      setSelected(prev => new Set([...prev].filter(c => json.rows.some((r: Row) => r.contrato === c))))
    } catch (e: any) { setError(e.message || 'Error inesperado') }
    finally { setLoading(false) }
  }, [search, plataforma, fechaDesde, fechaHasta])

  useEffect(() => { fetchData() }, [fetchData])

  const rows = data?.rows ?? []
  const allSelectedVisible = rows.length > 0 && rows.every(r => selected.has(r.contrato))
  const toggleOne = (c: string) => setSelected(prev => { const s = new Set(prev); s.has(c) ? s.delete(c) : s.add(c); return s })
  const markAllVisible = () => setSelected(new Set(rows.map(r => r.contrato)))
  const clearAll = () => setSelected(new Set())

  const handleCSV = () => {
    if (!rows.length) return
    const toExport = selected.size ? rows.filter(r => selected.has(r.contrato)) : rows
    exportToExcel(toExport, [
      { header: 'Nombre titular', accessor: r => r.nombre },
      { header: 'ID',             accessor: r => r.numeroId ?? '' },
      { header: 'Contrato',       accessor: r => r.contrato },
      { header: '# Beneficiarios', accessor: r => r.beneficiarios },
      { header: 'País',           accessor: r => r.plataforma ?? '' },
      { header: 'Email',          accessor: r => r.email ?? '' },
      { header: 'Asesor',         accessor: r => r.asesor ?? '' },
      { header: 'Fecha contrato', accessor: r => r.fechaContrato ?? '' },
    ], `contratos-prueba${plataforma ? '_' + plataforma : ''}`)
  }

  const handlePurgar = async () => {
    setPurgeModal(p => ({ ...p, saving: true }))
    try {
      const contratos = [...selected]
      const res = await fetch(`/api/admin/contratos-prueba/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratos, motivo: purgeModal.motivo.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al purgar')
      setPurgeResult({ ok: json.ok, failed: json.failed, total: json.total, results: json.results })
      setPurgeModal({ open: false, motivo: '', confirm: false, saving: false })
      setSelected(new Set())
      await fetchData()
    } catch (e: any) {
      alert(`Error: ${e?.message || 'error desconocido'}`)
      setPurgeModal(p => ({ ...p, saving: false }))
    }
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.CONTRATOS_PRUEBA}>
        <div className="space-y-5 pb-10">
          {/* Header */}
          <div className="flex items-center gap-3">
            <BeakerIcon className="h-7 w-7 text-orange-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Contratos Prueba</h1>
              <p className="text-sm text-gray-500">Listado de contratos con prefijo <code className="px-1 bg-orange-50 text-orange-700 rounded">PRB-</code> (creados como prueba). La purga borra en cascada todas las tablas afectadas y deja snapshot reversible en <code>PURGE_LOG</code>.</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="cp-search" className="block text-xs text-gray-500 mb-1">Buscar (nombre / ID / contrato)</label>
                <input id="cp-search" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ej: PRB-00001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="cp-pais" className="block text-xs text-gray-500 mb-1">Plataforma</label>
                <select id="cp-pais" value={plataforma} onChange={e => setPlataforma(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]">
                  <option value="">Todas</option>
                  {(data?.plataformas ?? []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cp-desde" className="block text-xs text-gray-500 mb-1">Desde (fecha contrato)</label>
                <input id="cp-desde" type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="cp-hasta" className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input id="cp-hasta" type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={fetchData} disabled={loading}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><ArrowPathIcon className="h-4 w-4" />Recargar</button>
                <button type="button" onClick={handleCSV} disabled={loading || !rows.length}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"><ArrowDownTrayIcon className="h-4 w-4" />CSV</button>
              </div>
            </div>
          </div>

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}
              <button type="button" onClick={fetchData} className="ml-4 text-xs underline">Reintentar</button></div>
          )}

          {/* Resultado de la última purga */}
          {purgeResult && (
            <div className={`rounded-xl border p-4 ${purgeResult.failed > 0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <strong>Purga ejecutada:</strong> {purgeResult.ok} OK · {purgeResult.failed} fallidos · {purgeResult.total} total.
                </div>
                <button type="button" onClick={() => setPurgeResult(null)} className="text-xs underline text-gray-600">Cerrar</button>
              </div>
              {purgeResult.failed > 0 && (
                <ul className="mt-2 text-xs text-amber-800 list-disc ml-5">
                  {purgeResult.results.filter(r => r.status !== 'ok').map(r => (<li key={r.contrato}><strong>{r.contrato}:</strong> {r.error || r.status}</li>))}
                </ul>
              )}
            </div>
          )}

          {/* Selección + botón aplicar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-gray-600">
              <strong>{selected.size}</strong> seleccionados · <strong>{rows.length}</strong> visibles · <strong>{data?.total ?? 0}</strong> totales
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={markAllVisible} disabled={!rows.length} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50">Marcar todos visibles</button>
              <button type="button" onClick={clearAll} disabled={selected.size === 0} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50">Limpiar</button>
              <button type="button" onClick={() => setPurgeModal({ open: true, motivo: '', confirm: false, saving: false })}
                disabled={selected.size === 0}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-bold">
                APLICAR MANTENIMIENTO ({selected.size})
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {loading ? <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
              : !rows.length ? <p className="p-8 text-center text-sm text-gray-400">No hay contratos de prueba con esos filtros.</p>
              : (
                <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 text-left"><input type="checkbox" checked={allSelectedVisible} onChange={e => e.target.checked ? markAllVisible() : clearAll()} /></th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Nombre titular</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Contrato</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase"># Benef</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">País</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Asesor</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Fecha contrato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map(r => (
                        <tr key={r.contrato} className={selected.has(r.contrato) ? 'bg-orange-50/60' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.contrato)} onChange={() => toggleOne(r.contrato)} /></td>
                          <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap"><a href={`/person/${r.titularId}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{r.nombre || '—'}</a></td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.numeroId ?? '—'}</td>
                          <td className="px-3 py-2 font-mono text-xs"><span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-bold">{r.contrato}</span></td>
                          <td className="px-3 py-2 text-center text-gray-700">{r.beneficiarios}</td>
                          <td className="px-3 py-2 text-gray-600">{r.plataforma ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.asesor ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.fechaContrato ? new Date(r.fechaContrato).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>

          {/* Modal de purga */}
          {purgeModal.open && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-gray-900/60" onClick={() => !purgeModal.saving && setPurgeModal({ open: false, motivo: '', confirm: false, saving: false })} />
                <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start gap-3 mb-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Aplicar mantenimiento</h3>
                      <p className="text-sm text-gray-600">Se borrarán <strong>{selected.size}</strong> contratos de prueba y todas las filas dependientes (PEOPLE, ACADEMICA, ACADEMICA_BOOKINGS, FINANCIEROS, PAGOS_TITULARES, STEP_OVERRIDES, COMPLEMENTARIA_ATTEMPTS, USUARIOS_ROLES). Cada purga es una transacción atómica.</p>
                    </div>
                  </div>

                  <div className="bg-red-50 border-l-4 border-red-500 rounded p-3 text-sm text-red-800 mb-4">
                    <strong>ATENCIÓN — acción destructiva.</strong> Se guarda <em>snapshot completo</em> en <code>PURGE_LOG</code> para auditoría y recuperación manual si fuera necesario, pero las filas se eliminan físicamente.
                  </div>

                  <details className="text-xs text-gray-600 mb-3">
                    <summary className="cursor-pointer font-medium">Ver contratos a purgar ({selected.size})</summary>
                    <ul className="mt-2 ml-5 list-disc max-h-32 overflow-y-auto">
                      {[...selected].map(c => <li key={c} className="font-mono">{c}</li>)}
                    </ul>
                  </details>

                  <label className="block text-sm font-medium text-gray-700">Motivo del mantenimiento (obligatorio)</label>
                  <textarea rows={3} value={purgeModal.motivo}
                    onChange={e => setPurgeModal(p => ({ ...p, motivo: e.target.value }))}
                    disabled={purgeModal.saving}
                    placeholder="ej: Purga semanal de contratos de prueba creados durante capacitación de comercial…"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />

                  <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={purgeModal.confirm}
                      onChange={e => setPurgeModal(p => ({ ...p, confirm: e.target.checked }))}
                      disabled={purgeModal.saving}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    Confirmo eliminación <strong>irreversible</strong> de estos contratos y todos sus registros asociados.
                  </label>

                  <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={() => setPurgeModal({ open: false, motivo: '', confirm: false, saving: false })}
                      disabled={purgeModal.saving}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
                    <button type="button" onClick={handlePurgar}
                      disabled={!purgeModal.confirm || !purgeModal.motivo.trim() || purgeModal.saving}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold inline-flex items-center gap-2">
                      {purgeModal.saving ? 'Purgando…' : <><CheckCircleIcon className="h-4 w-4" /> PURGAR {selected.size}</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
