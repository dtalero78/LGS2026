'use client'

import { useState, useEffect, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { ComercialPermission } from '@/types/permissions'
import { exportToExcel } from '@/lib/export-excel'
import { User, Filter, Download, ChevronLeft, ChevronRight, AlertCircle, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Matricula {
  _id: string
  primerNombre: string
  primerApellido: string
  segundoApellido?: string
  numeroId: string
  contrato: string
  celular: string
  email: string
  plataforma: string
  aprobacion?: string
  estado?: string
  hashConsentimiento?: string
  asesorAsignado?: string
  asesor?: string
  _createdDate: Date
  fechaIngreso?: string | Date | null
  numBeneficiarios?: number
  categoria?: string
}

interface FilterState {
  categoria: string
  plataforma: string
  asesor: string
  contrato: string
  fechaInicio: Date | null
  fechaFin: Date | null
}

// Estados del filtro (segunda imagen + Aprobados). Default = Aprobados.
const ESTADOS = [
  { value: 'Aprobados', label: 'Aprobados' },
  { value: '', label: 'Todos los contratos' },
  { value: 'Rechazado', label: 'Rechazado' },
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En revisión', label: 'En revisión' },
  { value: 'Firmado sin aprobar', label: 'Firmado sin aprobar' },
  { value: 'Sin firmar', label: 'Sin firmar' },
]

const RECORDS_PER_PAGE = 10

function categoriaBadge(cat?: string) {
  switch (cat) {
    case 'Aprobados': return 'bg-green-100 text-green-800'
    case 'Firmado sin aprobar': return 'bg-orange-100 text-orange-800'
    case 'Sin firmar': return 'bg-gray-200 text-gray-700'
    case 'Pendiente': return 'bg-yellow-100 text-yellow-800'
    case 'En revisión': return 'bg-blue-100 text-blue-800'
    case 'Rechazado': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString() : ''
const puedeBorrar = (m: Matricula) => m.categoria === 'Sin firmar'

export default function MatriculasPage() {
  const { hasPermission } = usePermissions()
  const canDelete = hasPermission(ComercialPermission.MATRICULAS_BORRAR)

  const [all, setAll] = useState<Matricula[]>([])
  const [rows, setRows] = useState<Matricula[]>([])
  const [loading, setLoading] = useState(true)
  const [searchApellido, setSearchApellido] = useState('')
  const [filters, setFilters] = useState<FilterState>({ categoria: 'Aprobados', plataforma: '', asesor: '', contrato: '', fechaInicio: null, fechaFin: null })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/postgres/matriculas', { headers: { 'Content-Type': 'application/json' } })
      const j = await r.json()
      setAll(j?.success && j.matriculas ? j.matriculas : [])
    } catch { setAll([]) } finally { setLoading(false) }
  }

  const getFiltered = (): Matricula[] => {
    let data = [...all]
    if (searchApellido.trim()) {
      const t = searchApellido.toLowerCase().trim()
      data = data.filter(c => `${c.primerApellido || ''} ${c.segundoApellido || ''} ${c.primerNombre || ''}`.toLowerCase().includes(t))
    }
    if (filters.categoria) data = data.filter(c => c.categoria === filters.categoria)
    if (filters.plataforma) { const p = filters.plataforma.toLowerCase().trim(); data = data.filter(c => (c.plataforma || '').toLowerCase().trim() === p) }
    if (filters.asesor.trim()) { const a = filters.asesor.toLowerCase().trim(); data = data.filter(c => (c.asesorAsignado || '').toLowerCase().includes(a)) }
    if (filters.contrato.trim()) { const n = filters.contrato.toLowerCase().trim(); data = data.filter(c => (c.contrato || '').toLowerCase().includes(n)) }
    if (filters.fechaInicio) data = data.filter(c => new Date(c._createdDate) >= filters.fechaInicio!)
    if (filters.fechaFin) { const ff = new Date(filters.fechaFin); ff.setHours(23, 59, 59, 999); data = data.filter(c => new Date(c._createdDate) <= ff) }
    return data
  }

  const paginate = (data: Matricula[]) => { setTotalPages(Math.ceil(data.length / RECORDS_PER_PAGE)); setCurrentPage(1); setRows(data.slice(0, RECORDS_PER_PAGE)) }
  const changePage = (p: number) => { if (p < 1 || p > totalPages) return; setCurrentPage(p); const s = (p - 1) * RECORDS_PER_PAGE; setRows(getFiltered().slice(s, s + RECORDS_PER_PAGE)) }

  useEffect(() => { load() }, [])
  useEffect(() => { paginate(getFiltered()); setSelected(new Set()) /* eslint-disable-next-line */ }, [all, searchApellido, filters.categoria, filters.plataforma, filters.asesor, filters.contrato, filters.fechaInicio, filters.fechaFin])

  const filtered = getFiltered()
  const plataformaOptions = useMemo(() => Array.from(new Set(all.map(c => (c.plataforma || '').trim()).filter(Boolean))).sort(), [all])
  const selectedRows = filtered.filter(c => selected.has(c.contrato) && puedeBorrar(c))

  const toggle = (contrato: string) => setSelected(prev => { const n = new Set(prev); n.has(contrato) ? n.delete(contrato) : n.add(contrato); return n })

  const doDelete = async () => {
    if (selectedRows.length === 0) return
    setDeleting(true)
    try {
      const r = await fetch('/api/postgres/matriculas/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratos: selectedRows.map(c => c.contrato) }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j?.error || 'Error al borrar'); return }
      toast.success(j?.message || 'Borrado completado')
      setShowModal(false); setSelected(new Set())
      await load()
    } catch { toast.error('Error al borrar. Intenta de nuevo.') } finally { setDeleting(false) }
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={ComercialPermission.MATRICULAS_VER} showDefaultMessage>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 Matrículas</h1>
              <p className="mt-2 text-sm text-gray-700">Consulta de contratos y borrado de matrículas sin firmar</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => exportToExcel(filtered, [
                { header: 'Titular', accessor: (c) => `${c.primerNombre} ${c.primerApellido}`.trim() },
                { header: 'Documento', accessor: (c) => c.numeroId },
                { header: 'Contrato', accessor: (c) => c.contrato },
                { header: 'Plataforma', accessor: (c) => c.plataforma },
                { header: 'Asesor', accessor: (c) => c.asesorAsignado || '' },
                { header: 'Fecha Contrato', accessor: (c) => fmtDate(c._createdDate) },
                { header: 'Celular', accessor: (c) => c.celular },
                { header: 'Email', accessor: (c) => c.email },
                { header: 'Estado', accessor: (c) => c.categoria || '' },
                { header: 'Fecha Aprobación', accessor: (c) => fmtDate(c.fechaIngreso) },
              ], `matriculas-${new Date().toISOString().split('T')[0]}`)}
                disabled={filtered.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
                <Download className="w-4 h-4" /> Exportar Excel
              </button>
              <button type="button" onClick={() => load()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Filter className="w-4 h-4" /> Actualizar
              </button>
              {canDelete && (
                <button type="button" onClick={() => selectedRows.length > 0 && setShowModal(true)}
                  disabled={selectedRows.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Borrar matrícula{selectedRows.length > 0 ? ` (${selectedRows.length})` : ''}
                </button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-3">
                <label htmlFor="q" className="block text-sm font-medium text-gray-700 mb-1">Buscar (apellido/nombre)</label>
                <input id="q" type="text" placeholder="Apellido o nombre..." value={searchApellido} onChange={e => setSearchApellido(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Asesor</label>
                <input type="text" aria-label="Asesor" placeholder="Nombre asesor..." value={filters.asesor} onChange={e => setFilters(p => ({ ...p, asesor: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1"># Contrato</label>
                <input type="text" aria-label="Numero de contrato" placeholder="01-..." value={filters.contrato} onChange={e => setFilters(p => ({ ...p, contrato: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select aria-label="Estado" value={filters.categoria} onChange={e => setFilters(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  {ESTADOS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                <select aria-label="Plataforma" value={filters.plataforma} onChange={e => setFilters(p => ({ ...p, plataforma: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Todas</option>
                  {plataformaOptions.map(p => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div className="lg:col-span-12">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rango de fechas (fecha de contrato)</label>
                <div className="flex gap-2 max-w-md">
                  <input type="date" aria-label="Desde" value={filters.fechaInicio ? filters.fechaInicio.toISOString().split('T')[0] : ''}
                    onChange={e => { if (e.target.value) { const [y, m, d] = e.target.value.split('-'); setFilters(p => ({ ...p, fechaInicio: new Date(+y, +m - 1, +d) })) } else setFilters(p => ({ ...p, fechaInicio: null })) }}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <input type="date" aria-label="Hasta" value={filters.fechaFin ? filters.fechaFin.toISOString().split('T')[0] : ''}
                    onChange={e => { if (e.target.value) { const [y, m, d] = e.target.value.split('-'); setFilters(p => ({ ...p, fechaFin: new Date(+y, +m - 1, +d) })) } else setFilters(p => ({ ...p, fechaFin: null })) }}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Resultados + paginación */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Registros filtrados ({filtered.length}){canDelete && selectedRows.length > 0 ? ` · ${selectedRows.length} seleccionado(s)` : ''}</h2>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" title="Anterior" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 py-1 text-sm">{currentPage} de {totalPages}</span>
                <button type="button" title="Siguiente" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="card p-12 text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" /><p className="mt-4 text-gray-600">Cargando...</p></div>
          ) : rows.length === 0 ? (
            <div className="card p-12 text-center"><AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900 mb-2">No hay contratos</h3><p className="text-gray-500">No se encontraron con los filtros aplicados</p></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {canDelete && <th className="px-4 py-3 w-10"><span className="sr-only">Seleccionar</span></th>}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titular</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Contrato</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Aprobación</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map(c => {
                      const selectable = puedeBorrar(c)
                      return (
                        <tr key={c._id} className="hover:bg-gray-50">
                          {canDelete && (
                            <td className="px-4 py-4">
                              <input type="checkbox" aria-label={`Seleccionar ${c.contrato}`}
                                checked={selected.has(c.contrato)} disabled={!selectable}
                                onChange={() => toggle(c.contrato)}
                                title={selectable ? 'Seleccionar para borrar' : 'Solo se pueden borrar contratos SIN FIRMAR'}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed" />
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => window.open(`/dashboard/comercial/matriculas/${c._id}`, '_blank')}>
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-5 w-5 text-blue-600" /></div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{c.primerNombre} {c.primerApellido}</div>
                                <div className="text-sm text-gray-500">{c.numeroId} {c.asesorAsignado ? `· ${c.asesorAsignado}` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{c.contrato}</div><div className="text-sm text-gray-500">{c.plataforma}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fmtDate(c._createdDate)}</td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{c.celular}</div><div className="text-sm text-gray-500">{c.email}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${categoriaBadge(c.categoria)}`}>{c.categoria || '—'}</span></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fmtDate(c.fechaIngreso)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal de confirmación de borrado */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[85vh] overflow-auto">
              <div className="flex justify-between items-center p-5 border-b border-red-100 bg-red-50 rounded-t-lg">
                <h3 className="text-lg font-bold text-red-800 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Borrar matrícula(s)</h3>
                <button type="button" onClick={() => setShowModal(false)} title="Cerrar" className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-700 mb-3">
                  ⚠️ Esta acción <strong>borra en cascada e irreversiblemente</strong> el contrato: <strong>titular, beneficiarios, financiera y pagos</strong>. Solo aplica a contratos <strong>SIN FIRMAR</strong>. Confirma los {selectedRows.length} contrato(s):
                </p>
                <div className="border border-gray-100 rounded-lg divide-y max-h-[45vh] overflow-auto">
                  {selectedRows.map(c => (
                    <div key={c._id} className="px-3 py-2 text-sm">
                      <div className="font-medium text-gray-900">{c.primerNombre} {c.primerApellido} <span className="text-gray-400 font-normal">· {c.numeroId}</span></div>
                      <div className="text-gray-600 text-xs mt-0.5">
                        Contrato <strong>{c.contrato}</strong> · {c.plataforma} · Fecha: {fmtDate(c._createdDate)} ·{' '}
                        {c.numBeneficiarios && c.numBeneficiarios > 0
                          ? <span className="text-amber-700">{c.numBeneficiarios} beneficiario(s)</span>
                          : <span className="text-gray-400">sin beneficiarios</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
                <button type="button" onClick={doDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> {deleting ? 'Borrando...' : `Borrar ${selectedRows.length} matrícula(s)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </PermissionGuard>
    </DashboardLayout>
  )
}
