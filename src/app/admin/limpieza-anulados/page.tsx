'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowDownTrayIcon, ArrowPathIcon, TrashIcon, ExclamationTriangleIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { MantenimientoPermission } from '@/types/permissions'

interface Row {
  titularId: string
  contrato: string
  nombre: string
  numeroId: string | null
  plataforma: string | null
  aprobacion: string | null
  estado: string | null
  anuladoEl: string | null
  beneficiarios: number
  pagos: number
  pagosValidados: number
  docsCompartidos: number
}

interface HistRow {
  _id: string
  contrato: string
  categoria?: 'Anulado' | 'Retractado'
  titularNombre: string | null
  motivo: string
  realizadoPor: string
  realizadoPorNombre: string | null
  filasBorradas: Record<string, number> | null
  fecha: string
}

interface PurgeResultItem {
  contrato: string
  status: string
  error?: string
}

const fmtFecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export default function LimpiezaAnuladosPage() {
  const [tab, setTab] = useState<'anulados' | 'retractados' | 'historico'>('anulados')
  // Las pestañas Anulados y Retractados comparten la misma tabla/acciones; cambia la categoría.
  const esLista = tab === 'anulados' || tab === 'retractados'
  const etiqueta = tab === 'retractados' ? 'retractado' : 'anulado'

  // ── Anulados ──
  const [search, setSearch] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [minDias, setMinDias] = useState('0')
  const [estado, setEstado] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [plataformas, setPlataformas] = useState<string[]>([])
  const [estados, setEstados] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ open: boolean; motivo: string; confirm: boolean; confirmValidados: boolean; saving: boolean }>({ open: false, motivo: '', confirm: false, confirmValidados: false, saving: false })
  const cerrarModal = () => setModal({ open: false, motivo: '', confirm: false, confirmValidados: false, saving: false })
  // Casilla: habilita seleccionar contratos con pagos VALIDADOS (pide 2ª confirmación al borrar).
  const [permitirValidados, setPermitirValidados] = useState(false)
  const [result, setResult] = useState<{ ok: number; omitidos: number; failed: number; total: number; results: PurgeResultItem[] } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (plataforma) qs.set('plataforma', plataforma)
      if (minDias !== '0') qs.set('minDias', minDias)
      if (estado) qs.set('estado', estado)
      qs.set('categoria', tab === 'retractados' ? 'retractados' : 'anulados')
      const res = await fetch(`/api/admin/limpieza-anulados/list?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar')
      setRows(json.rows)
      setPlataformas(json.plataformas || [])
      setEstados(json.estados || [])
      setSelected(prev => new Set([...prev].filter(c => json.rows.some((r: Row) => r.contrato === c))))
    } catch (e: any) { setError(e.message || 'Error inesperado') }
    finally { setLoading(false) }
  }, [search, plataforma, minDias, estado, tab])

  useEffect(() => { if (esLista) fetchData() }, [fetchData, esLista])
  // Al cambiar de pestaña se limpia la selección y el filtro de estado (son listas distintas).
  useEffect(() => { setSelected(new Set()); setEstado(''); setResult(null) }, [tab])

  const seleccionables = rows.filter(r => r.pagosValidados === 0 || permitirValidados)
  // Al desmarcar la casilla, se quitan de la selección los que tienen pagos validados.
  useEffect(() => {
    if (!permitirValidados) {
      setSelected(prev => new Set([...prev].filter(c => (rows.find(r => r.contrato === c)?.pagosValidados ?? 0) === 0)))
    }
  }, [permitirValidados, rows])
  const selConValidados = rows.filter(r => selected.has(r.contrato) && r.pagosValidados > 0)
  const totalPagosValidadosSel = selConValidados.reduce((a, r) => a + r.pagosValidados, 0)
  const allSelected = seleccionables.length > 0 && seleccionables.every(r => selected.has(r.contrato))
  const toggleOne = (c: string) => setSelected(prev => { const s = new Set(prev); s.has(c) ? s.delete(c) : s.add(c); return s })
  const markAll = () => setSelected(new Set(seleccionables.map(r => r.contrato)))
  const clearAll = () => setSelected(new Set())

  const handleCSV = () => {
    if (!rows.length) return
    const data = selected.size ? rows.filter(r => selected.has(r.contrato)) : rows
    exportToExcel(data, [
      { header: 'Titular', accessor: r => r.nombre },
      { header: 'ID', accessor: r => r.numeroId ?? '' },
      { header: 'Contrato', accessor: r => r.contrato },
      { header: 'Estado', accessor: r => r.aprobacion || r.estado || '' },
      { header: '# Beneficiarios', accessor: r => r.beneficiarios },
      { header: 'Pagos', accessor: r => r.pagos },
      { header: 'Pagos validados', accessor: r => r.pagosValidados },
      { header: 'Docs con otro contrato', accessor: r => r.docsCompartidos },
      { header: 'País', accessor: r => r.plataforma ?? '' },
      { header: 'Anulado (última modificación)', accessor: r => fmtFecha(r.anuladoEl) },
    ], tab === 'retractados' ? 'contratos-retractados' : 'contratos-anulados')
  }

  const handleBorrar = async () => {
    setModal(m => ({ ...m, saving: true }))
    try {
      const res = await fetch('/api/admin/limpieza-anulados/purge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratos: [...selected],
          motivo: modal.motivo.trim(),
          categoria: tab === 'retractados' ? 'retractados' : 'anulados',
          incluirPagosValidados: selConValidados.length > 0 && modal.confirmValidados,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al borrar')
      setResult({ ok: json.ok, omitidos: json.omitidos, failed: json.failed, total: json.total, results: json.results })
      cerrarModal()
      setSelected(new Set())
      await fetchData()
    } catch (e: any) {
      alert(`Error: ${e?.message || 'error desconocido'}`)
      setModal(m => ({ ...m, saving: false }))
    }
  }

  // ── Histórico ──
  const [hSearch, setHSearch] = useState('')
  const [hRows, setHRows] = useState<HistRow[]>([])
  const [hLoading, setHLoading] = useState(false)
  const [hError, setHError] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<any | null>(null)
  const [detalleLoading, setDetalleLoading] = useState(false)

  const fetchHistorico = useCallback(async () => {
    setHLoading(true); setHError(null)
    try {
      const qs = new URLSearchParams()
      if (hSearch) qs.set('search', hSearch)
      const res = await fetch(`/api/admin/limpieza-anulados/historico?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar')
      setHRows(json.rows)
    } catch (e: any) { setHError(e.message || 'Error inesperado') }
    finally { setHLoading(false) }
  }, [hSearch])

  useEffect(() => { if (tab === 'historico') fetchHistorico() }, [fetchHistorico, tab])

  const verDetalle = async (id: string) => {
    setDetalleLoading(true); setDetalle({ loading: true })
    try {
      const res = await fetch(`/api/admin/limpieza-anulados/historico?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error')
      setDetalle(json)
    } catch (e: any) { setDetalle({ error: e.message || 'Error' }) }
    finally { setDetalleLoading(false) }
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.LIMPIEZA_ANULADOS}>
        <div className="space-y-5 pb-10">
          <div className="flex items-center gap-3">
            <TrashIcon className="h-7 w-7 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Limpieza de Anulados</h1>
              <p className="text-sm text-gray-500">
                Contratos anulados (<em>Contrato nulo</em>, <em>Devuelto</em>, <em>Rechazado</em>) y, en su propia pestaña, los <em>Retractados</em>
                (el cliente se retractó en el plazo legal: quedan inhabilitados y aquí se decide si se borran o se conservan como histórico).
                La depuración es <strong>manual</strong> desde aquí.
                Cada borrado queda registrado en el <strong>Histórico</strong> como referencia.
              </p>
            </div>
          </div>

          <div className="flex gap-2 border-b border-gray-200">
            {(['anulados', 'retractados', 'historico'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t === 'anulados' ? 'Anulados' : t === 'retractados' ? 'Retractados' : 'Histórico de borrados'}
              </button>
            ))}
          </div>

          {esLista && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
                {tab === 'retractados' && (<><strong>Retractados:</strong> sus personas ya están inhabilitadas (sin acceso). Los que no borre quedan aquí como histórico. </>)}
                <strong>Qué se borra:</strong> el contrato {etiqueta} completo (titular, beneficiarios, financiero, pagos no validados, inscripción Kids).
                <strong> Qué se conserva:</strong> la ficha académica, las clases y el login de quien tenga <strong>otro contrato</strong> (columna “Otro contrato”).
                Los contratos con <strong>pagos validados</strong> solo se pueden seleccionar activando la casilla
                <em> “Permitir borrar contratos con pagos validados”</em>, y piden una confirmación adicional.
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="la-search" className="block text-xs text-gray-500 mb-1">Buscar (nombre / ID / contrato)</label>
                    <input id="la-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="la-pais" className="block text-xs text-gray-500 mb-1">Plataforma</label>
                    <select id="la-pais" value={plataforma} onChange={e => setPlataforma(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]">
                      <option value="">Todas</option>
                      {plataformas.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="la-estado" className="block text-xs text-gray-500 mb-1">Estado</label>
                    <select id="la-estado" value={estado} onChange={e => setEstado(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[150px]">
                      <option value="">Todos</option>
                      {estados.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="la-dias" className="block text-xs text-gray-500 mb-1">Antigüedad de la anulación</label>
                    <select id="la-dias" value={minDias} onChange={e => setMinDias(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option value="0">Todas (incluye recientes)</option>
                      <option value="7">Más de 7 días</option>
                      <option value="15">Más de 15 días</option>
                      <option value="30">Más de 30 días</option>
                    </select>
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

              {result && (
                <div className={`rounded-xl border p-4 ${result.failed + result.omitidos > 0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm"><strong>Limpieza ejecutada:</strong> {result.ok} borrados · {result.omitidos} omitidos · {result.failed} fallidos · {result.total} total.</div>
                    <button type="button" onClick={() => setResult(null)} className="text-xs underline text-gray-600">Cerrar</button>
                  </div>
                  {result.results.some(r => r.status !== 'ok') && (
                    <ul className="mt-2 text-xs text-amber-800 list-disc ml-5">
                      {result.results.filter(r => r.status !== 'ok').map(r => <li key={r.contrato}><strong>{r.contrato}:</strong> {r.error || r.status}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    <strong>{selected.size}</strong> seleccionados · <strong>{rows.length}</strong> anulados
                    {rows.filter(r => r.pagosValidados > 0).length > 0 && <> · <span className="text-red-600">{rows.filter(r => r.pagosValidados > 0).length} con pagos validados</span></>}
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={permitirValidados} onChange={e => setPermitirValidados(e.target.checked)} />
                    Permitir borrar contratos con pagos validados
                  </label>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={markAll} disabled={!seleccionables.length} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50">Marcar todos</button>
                  <button type="button" onClick={clearAll} disabled={selected.size === 0} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50">Limpiar</button>
                  <button type="button" onClick={() => setModal({ open: true, motivo: '', confirm: false, confirmValidados: false, saving: false })}
                    disabled={selected.size === 0 || selected.size > 100}
                    title={selected.size > 100 ? 'Máximo 100 contratos por operación' : ''}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-bold">
                    BORRAR SELECCIONADOS ({selected.size})
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                {loading ? <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
                  : !rows.length ? <p className="p-8 text-center text-sm text-gray-400">No hay contratos anulados con esos filtros.</p>
                  : (
                    <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                          <tr>
                            <th className="px-3 py-2.5 text-left"><input type="checkbox" checked={allSelected} onChange={e => e.target.checked ? markAll() : clearAll()} /></th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Titular</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Contrato</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                            <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase"># Benef</th>
                            <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Pagos</th>
                            <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Otro contrato</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">País</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Anulado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map(r => {
                            const conValidados = r.pagosValidados > 0
                            const bloqueado = conValidados && !permitirValidados
                            return (
                              <tr key={r.contrato} className={bloqueado ? 'bg-gray-50 text-gray-400' : selected.has(r.contrato) ? (conValidados ? 'bg-red-100' : 'bg-red-50/60') : 'hover:bg-gray-50'}>
                                <td className="px-3 py-2"><input type="checkbox" disabled={bloqueado} checked={selected.has(r.contrato)} onChange={() => toggleOne(r.contrato)}
                                  title={bloqueado ? 'Tiene pagos validados: active "Permitir borrar contratos con pagos validados" para seleccionarlo' : ''} /></td>
                                <td className="px-3 py-2 font-medium whitespace-nowrap"><a href={`/person/${r.titularId}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{r.nombre || '—'}</a></td>
                                <td className="px-3 py-2 font-mono text-xs">{r.numeroId ?? '—'}</td>
                                <td className="px-3 py-2 font-mono text-xs"><span className="px-1.5 py-0.5 bg-gray-100 rounded font-bold">{r.contrato}</span></td>
                                <td className="px-3 py-2 text-xs">{r.aprobacion || r.estado || '—'}</td>
                                <td className="px-3 py-2 text-center">{r.beneficiarios}</td>
                                <td className="px-3 py-2 text-center text-xs">
                                  {r.pagos}{r.pagosValidados > 0 && <span className="ml-1 text-red-600 font-semibold">({r.pagosValidados} validados)</span>}
                                </td>
                                <td className="px-3 py-2 text-center text-xs">
                                  {r.docsCompartidos > 0
                                    ? <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800" title="Su ficha académica, clases y login se conservan">conserva {r.docsCompartidos}</span>
                                    : '—'}
                                </td>
                                <td className="px-3 py-2 text-xs">{r.plataforma ?? '—'}</td>
                                <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtFecha(r.anuladoEl)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </>
          )}

          {tab === 'historico' && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="lh-search" className="block text-xs text-gray-500 mb-1">Buscar (contrato / titular / quién borró)</label>
                  <input id="lh-search" type="text" value={hSearch} onChange={e => setHSearch(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <button type="button" onClick={fetchHistorico} disabled={hLoading}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><ArrowPathIcon className="h-4 w-4" />Recargar</button>
              </div>

              {hError && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{hError}</div>}

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                {hLoading ? <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
                  : !hRows.length ? <p className="p-8 text-center text-sm text-gray-400">Aún no hay contratos anulados ni retractados borrados.</p>
                  : (
                    <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                          <tr>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Contrato</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Titular</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Borrado por</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Motivo</th>
                            <th className="px-3 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {hRows.map(h => (
                            <tr key={h._id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(h.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                              <td className="px-3 py-2 font-mono text-xs font-bold">{h.contrato}</td>
                              <td className="px-3 py-2 text-xs">
                                <span className={`px-2 py-0.5 rounded ${h.categoria === 'Retractado' ? 'bg-gray-200 text-gray-800' : 'bg-red-100 text-red-800'}`}>{h.categoria || 'Anulado'}</span>
                              </td>
                              <td className="px-3 py-2">{h.titularNombre || '—'}</td>
                              <td className="px-3 py-2 text-xs">{h.realizadoPorNombre || h.realizadoPor}</td>
                              <td className="px-3 py-2 text-xs text-gray-600 max-w-xs break-words">{h.motivo}</td>
                              <td className="px-3 py-2 text-right">
                                <button type="button" onClick={() => verDetalle(h._id)} className="text-xs text-blue-700 underline">Ver</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </>
          )}

          {/* Modal de borrado */}
          {modal.open && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-gray-900/60" onClick={() => !modal.saving && cerrarModal()} />
                <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start gap-3 mb-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Borrar {selected.size} contrato(s) {etiqueta}(s)</h3>
                      <p className="text-sm text-gray-600">
                        Se borran definitivamente el titular, los beneficiarios, el financiero, los pagos no validados y la inscripción Kids de cada contrato.
                        Se <strong>conserva</strong> la ficha académica, las clases y el login de quien tenga otro contrato.
                      </p>
                    </div>
                  </div>
                  <div className="bg-red-50 border-l-4 border-red-500 rounded p-3 text-sm text-red-800 mb-4">
                    <strong>Acción irreversible.</strong> Queda una copia completa de cada contrato en el <em>Histórico de borrados</em>, solo para consulta.
                  </div>
                  <details className="text-xs text-gray-600 mb-3">
                    <summary className="cursor-pointer font-medium">Ver contratos ({selected.size})</summary>
                    <ul className="mt-2 ml-5 list-disc max-h-32 overflow-y-auto">
                      {[...selected].map(c => <li key={c} className="font-mono">{c}</li>)}
                    </ul>
                  </details>
                  <label className="block text-sm font-medium text-gray-700">Motivo (obligatorio)</label>
                  <textarea rows={3} value={modal.motivo} onChange={e => setModal(m => ({ ...m, motivo: e.target.value }))} disabled={modal.saving}
                    placeholder="ej: Depuración semanal de contratos anulados"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  {selConValidados.length > 0 && (
                    <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-50 p-3 text-sm text-red-900">
                      <div className="font-bold">⚠️ Incluye {selConValidados.length} contrato(s) con PAGOS VALIDADOS ({totalPagosValidadosSel} pago(s))</div>
                      <p className="mt-1 text-xs">
                        Son pagos ya recibidos y validados por Recaudos. Al borrar estos contratos desaparecen de los informes y del Estado de Cuenta;
                        solo quedarán en el Histórico de borrados. Verifique que no se necesitan para conciliación ni devoluciones.
                      </p>
                      <ul className="mt-1 ml-5 list-disc text-xs max-h-24 overflow-y-auto">
                        {selConValidados.map(r => <li key={r.contrato}><span className="font-mono">{r.contrato}</span> — {r.nombre} ({r.pagosValidados} validado(s))</li>)}
                      </ul>
                      <label className="mt-2 flex items-start gap-2 text-xs font-semibold">
                        <input type="checkbox" className="mt-0.5" checked={modal.confirmValidados} disabled={modal.saving}
                          onChange={e => setModal(m => ({ ...m, confirmValidados: e.target.checked }))} />
                        Confirmo que también se borren estos {totalPagosValidadosSel} pago(s) validado(s).
                      </label>
                    </div>
                  )}
                  <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={modal.confirm} onChange={e => setModal(m => ({ ...m, confirm: e.target.checked }))} disabled={modal.saving} />
                    Confirmo el borrado <strong>definitivo</strong> de estos contratos anulados.
                  </label>
                  <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={cerrarModal} disabled={modal.saving}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
                    <button type="button" onClick={handleBorrar}
                      disabled={!modal.confirm || modal.motivo.trim().length < 5 || modal.saving || (selConValidados.length > 0 && !modal.confirmValidados)}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold inline-flex items-center gap-2">
                      {modal.saving ? 'Borrando…' : <><CheckCircleIcon className="h-4 w-4" /> BORRAR {selected.size}</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal detalle histórico */}
          {detalle && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-gray-900/60" onClick={() => setDetalle(null)} />
                <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4">
                  {detalleLoading || detalle.loading ? <p className="text-sm text-gray-500">Cargando…</p>
                    : detalle.error ? <p className="text-sm text-red-600">{detalle.error}</p>
                    : (
                      <>
                        <div className="flex items-start gap-2">
                          <ClockIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Contrato {detalle.registro.contrato} (borrado)</h3>
                            <p className="text-xs text-gray-500">
                              Borrado el {new Date(detalle.registro.fecha).toLocaleString('es-CO')} por {detalle.registro.realizadoPor} · Motivo: {detalle.registro.motivo}
                            </p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800 mb-1">Personas</h4>
                          <table className="w-full text-xs">
                            <thead className="text-gray-500"><tr>
                              <th className="text-left py-1">Rol</th><th className="text-left">Nombre</th><th className="text-left">ID</th>
                              <th className="text-left">Correo</th><th className="text-left">Celular</th><th className="text-left">Estado</th><th className="text-left">Creado</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100">
                              {detalle.personas.map((p: any, i: number) => (
                                <tr key={i}>
                                  <td className="py-1">{p.tipoUsuario}</td><td>{p.nombre}</td><td className="font-mono">{p.numeroId}</td>
                                  <td>{p.email || '—'}</td><td>{p.celular || '—'}</td><td>{p.aprobacion || p.estado || '—'}</td><td>{fmtFecha(p.creado)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {detalle.financiero && (
                          <div className="text-xs text-gray-700">
                            <strong>Financiero:</strong> plan {detalle.financiero.totalPlan ?? '—'} · inscripción {detalle.financiero.pagoInscripcion ?? '—'} · cuotas {detalle.financiero.numeroCuotas ?? '—'} · saldo {detalle.financiero.saldo ?? '—'}
                          </div>
                        )}
                        <div className="text-xs text-gray-700">
                          <strong>Pagos borrados:</strong> {detalle.pagos.length}
                          {detalle.pagos.length > 0 && <> ({detalle.pagos.map((p: any) => `cuota ${p.numCuota}: ${p.valorPagado}${p.validado ? ' (validado)' : ''}`).join(' · ')})</>}
                        </div>
                        {(detalle.conservados?.documentos?.length > 0 || detalle.conservados?.correos?.length > 0) && (
                          <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2">
                            <strong>Se conservaron</strong> (tenían otro contrato): documentos {detalle.conservados.documentos.join(', ') || '—'} · correos {detalle.conservados.correos.join(', ') || '—'}
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button type="button" onClick={() => setDetalle(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cerrar</button>
                        </div>
                      </>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
