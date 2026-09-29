'use client'

import { useState, useEffect, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { ComercialPermission } from '@/types/permissions'
import { exportToExcel } from '@/lib/export-excel'
import { User, Filter, Download, ChevronLeft, ChevronRight, AlertCircle, Trash2, X, Pencil, EyeOff, Clock, FileText, Upload, Receipt } from 'lucide-react'
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

// ── Pestaña "En Gestión" ──
// Contratos recién creados (≤8h) que aún no están aprobados. Categorías incluidas
// (whitelist explícita: no aprobados ni rechazados).
const EN_GESTION_CATS = ['Sin firmar', 'Firmado sin aprobar', 'En revisión', 'Pendiente']
const OCHO_HORAS_MS = 8 * 60 * 60 * 1000
// Ocultos "quitados de la lista": solo este navegador (localStorage), auto-purgado a 8h.
const LS_GESTION_OCULTOS = 'matriculas_gestion_ocultos_v1'

function loadGestionOcultos(): Record<string, number> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_GESTION_OCULTOS) : null
    const obj = raw ? JSON.parse(raw) : {}
    const now = Date.now()
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(obj)) {
      // Se purga lo quitado hace más de 8h (el contrato ya no aparece de todos modos).
      if (typeof v === 'number' && now - v < OCHO_HORAS_MS) out[k] = v
    }
    return out
  } catch { return {} }
}

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
const fmtDateTime = (v: any) => v ? new Date(v).toLocaleString() : ''
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

  // Pestaña activa + ocultos de "En Gestión" (localStorage)
  const [activeTab, setActiveTab] = useState<'consulta' | 'gestion'>('consulta')
  const [gestionOcultos, setGestionOcultos] = useState<Record<string, number>>({})
  useEffect(() => { setGestionOcultos(loadGestionOcultos()) }, [])

  const quitarDeGestion = (contrato: string) => {
    if (!contrato) return
    setGestionOcultos(prev => {
      const next = { ...prev, [contrato]: Date.now() }
      try { window.localStorage.setItem(LS_GESTION_OCULTOS, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  // ── Modal Documentación + Recibo (para contratos "Firmado sin aprobar") ──
  const [docModal, setDocModal] = useState<Matricula | null>(null)
  const [docsList, setDocsList] = useState<any[]>([])
  const [reciboData, setReciboData] = useState<any | null>(null)
  const [reciboActive, setReciboActive] = useState(false)
  const [docLoading, setDocLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadingRecibo, setUploadingRecibo] = useState(false)

  const openDocModal = async (c: Matricula) => {
    setDocModal(c); setDocsList([]); setReciboData(null); setReciboActive(false); setDocLoading(true)
    try {
      const [d, r] = await Promise.all([
        fetch(`/api/contracts/${c._id}/documents`).then(x => x.json()).catch(() => null),
        fetch(`/api/contracts/${c._id}/recibo-inscripcion`).then(x => x.json()).catch(() => null),
      ])
      if (d?.success) setDocsList(d.documentacion || [])
      if (r?.success) { setReciboData(r.recibo || null); setReciboActive(!!r.active) }
    } finally { setDocLoading(false) }
  }

  const uploadDocs = async (files: File[]) => {
    if (!docModal || !files.length) return
    setUploadingDoc(true)
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const up = await fetch(`/api/contracts/${docModal._id}/upload-url`, { method: 'POST', body: fd })
        if (!up.ok) { const e = await up.json().catch(() => ({})); throw new Error(e.error || `Error ${up.status}`) }
        const { publicUrl } = await up.json()
        const saved = await fetch(`/api/contracts/${docModal._id}/documents`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: publicUrl, nombre: file.name, tipo: file.type }),
        }).then(x => x.json())
        if (saved?.success) setDocsList(saved.documentacion || [])
      }
      toast.success('Documentación subida')
    } catch (e: any) { toast.error(e?.message || 'Error subiendo documentación') } finally { setUploadingDoc(false) }
  }

  const deleteDoc = async (url: string, nombre: string) => {
    if (!docModal) return
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    try {
      const d = await fetch(`/api/contracts/${docModal._id}/documents`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      }).then(x => x.json())
      if (d?.success) setDocsList(d.documentacion || [])
    } catch { toast.error('No se pudo eliminar') }
  }

  const uploadRecibo = async (file: File) => {
    if (!docModal) return
    setUploadingRecibo(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const up = await fetch(`/api/contracts/${docModal._id}/upload-url`, { method: 'POST', body: fd })
      if (!up.ok) { const e = await up.json().catch(() => ({})); throw new Error(e.error || `Error ${up.status}`) }
      const { publicUrl } = await up.json()
      const saved = await fetch(`/api/contracts/${docModal._id}/recibo-inscripcion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: publicUrl, nombre: file.name, tipo: file.type }),
      }).then(x => x.json())
      if (!saved?.success) throw new Error(saved?.error || 'No se pudo guardar el recibo')
      setReciboData(saved.recibo || null)
      toast.success('Recibo de inscripción subido')
    } catch (e: any) { toast.error(e?.message || 'Error subiendo el recibo') } finally { setUploadingRecibo(false) }
  }

  const pickFiles = (multiple: boolean, cb: (files: File[]) => void) => {
    const i = document.createElement('input')
    i.type = 'file'; i.multiple = multiple; i.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf'
    i.onchange = () => { cb(Array.from(i.files || [])) }
    i.click()
  }

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
  // La columna "Documentos" (documentación + recibo) aparece si hay algún contrato
  // Firmado sin aprobar en el resultado — así también funciona con "Todos los contratos".
  const showDocsCol = filtered.some(c => c.categoria === 'Firmado sin aprobar')
  const plataformaOptions = useMemo(() => Array.from(new Set(all.map(c => (c.plataforma || '').trim()).filter(Boolean))).sort(), [all])
  const selectedRows = filtered.filter(c => selected.has(c.contrato) && puedeBorrar(c))

  // "En Gestión": creados ≤8h, no aprobados/rechazados, no quitados a mano.
  const enGestion = useMemo(() => {
    const now = Date.now()
    return all
      .filter(c => EN_GESTION_CATS.includes(c.categoria || ''))
      .filter(c => c._createdDate && (now - new Date(c._createdDate).getTime()) < OCHO_HORAS_MS)
      .filter(c => !gestionOcultos[c.contrato])
      .sort((a, b) => new Date(b._createdDate).getTime() - new Date(a._createdDate).getTime())
  }, [all, gestionOcultos])

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📋 Matrículas</h1>
            <p className="mt-2 text-sm text-gray-700">Consulta de contratos y borrado de matrículas sin firmar</p>
          </div>

          {/* Pestañas */}
          <div className="flex gap-6 border-b border-gray-200">
            <button type="button" onClick={() => setActiveTab('consulta')}
              className={`px-1 pb-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'consulta' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Consulta
            </button>
            <button type="button" onClick={() => setActiveTab('gestion')}
              className={`px-1 pb-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 ${activeTab === 'gestion' ? 'border-fuchsia-600 text-fuchsia-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              En Gestión
              {enGestion.length > 0 && (
                <span className="inline-flex items-center justify-center bg-fuchsia-100 text-fuchsia-700 text-xs font-bold rounded-full px-2 py-0.5">{enGestion.length}</span>
              )}
            </button>
          </div>

          {activeTab === 'consulta' && (<>
          <div className="flex justify-end items-start">
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
                      {showDocsCol && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documentos</th>
                      )}
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
                          {showDocsCol && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              {c.categoria === 'Firmado sin aprobar' ? (
                                <button type="button" onClick={() => openDocModal(c)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                                  <FileText className="w-3.5 h-3.5" /> Documentos y recibo
                                </button>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </>)}

          {/* ── Pestaña En Gestión ── */}
          {activeTab === 'gestion' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Contratos en gestión ({enGestion.length})</h2>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Contratos creados en las últimas 8 horas que aún no están aprobados. Salen al aprobarse, al quitarlos de la lista, o al cumplir 8 horas desde su creación.
                  </p>
                </div>
                <button type="button" onClick={() => load()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 flex-shrink-0">
                  <Filter className="w-4 h-4" /> Actualizar
                </button>
              </div>

              {loading ? (
                <div className="card p-12 text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" /><p className="mt-4 text-gray-600">Cargando...</p></div>
              ) : enGestion.length === 0 ? (
                <div className="card p-12 text-center"><AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900 mb-2">No hay contratos en gestión</h3><p className="text-gray-500">Los contratos creados en las últimas 8 horas y sin aprobar aparecerán aquí.</p></div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titular</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha creación</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asesor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {enGestion.map(c => (
                          <tr key={c._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-5 w-5 text-blue-600" /></div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{c.primerNombre} {c.primerApellido}</div>
                                  <div className="text-sm text-gray-500">{c.numeroId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{c.contrato}</div><div className="text-sm text-gray-500">{c.plataforma}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fmtDateTime(c._createdDate)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{c.asesorAsignado || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${categoriaBadge(c.categoria)}`}>{c.categoria || '—'}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <div className="flex items-center justify-end gap-2">
                                <a href={`/dashboard/comercial/contrato/${c._id}`} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium">
                                  <Pencil className="w-3.5 h-3.5" /> Editar contrato
                                </a>
                                <button type="button" onClick={() => quitarDeGestion(c.contrato)} title="Quitar de la lista (solo en este navegador)"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-xs font-medium">
                                  <EyeOff className="w-3.5 h-3.5" /> Quitar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

        {/* Modal Documentación + Recibo (Firmado sin aprobar) */}
        {docModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-auto">
              <div className="flex justify-between items-center p-5 border-b border-indigo-100 bg-indigo-50 rounded-t-xl">
                <div>
                  <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2"><FileText className="w-5 h-5" /> Documentación y recibo</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{docModal.primerNombre} {docModal.primerApellido} · Contrato {docModal.contrato}</p>
                </div>
                <button type="button" onClick={() => setDocModal(null)} title="Cerrar" className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-6">
                {docLoading ? (
                  <div className="text-center text-gray-500 py-8">Cargando…</div>
                ) : (
                  <>
                    {/* Documentación */}
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><FileText className="w-4 h-4 text-indigo-600" /> Documentación</h4>
                        <button type="button" onClick={() => pickFiles(true, uploadDocs)} disabled={uploadingDoc}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                          <Upload className="w-3.5 h-3.5" /> {uploadingDoc ? 'Subiendo…' : 'Subir documentos'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">Documentos requeridos para la aprobación (imágenes o PDF). El recibo de pago va en la sección de abajo.</p>
                      {docsList.length === 0 ? (
                        <div className="text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg p-4 text-center">Sin documentos aún.</div>
                      ) : (
                        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                          {docsList.map((d: any, i: number) => (
                            <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate max-w-[75%]">{d.nombre || 'Documento'}</a>
                              <button type="button" onClick={() => deleteDoc(d.url, d.nombre || 'documento')} title="Eliminar" className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {/* Recibo de inscripción */}
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-emerald-600" /> Recibo de inscripción</h4>
                        {reciboActive && (
                          <button type="button" onClick={() => pickFiles(false, fs => { if (fs[0]) uploadRecibo(fs[0]) })} disabled={uploadingRecibo}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                            <Upload className="w-3.5 h-3.5" /> {uploadingRecibo ? 'Subiendo…' : (reciboData ? 'Reemplazar recibo' : 'Subir recibo')}
                          </button>
                        )}
                      </div>
                      {!reciboActive && !reciboData && (
                        <p className="text-xs text-amber-600 mb-2">La subida del recibo no está habilitada para tu usuario (requiere el permiso «Subir recibo» o que la lectura de recibos esté activa).</p>
                      )}
                      {reciboData ? (
                        <div className="text-sm border border-emerald-100 bg-emerald-50 rounded-lg p-3">
                          <a href={reciboData.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-medium hover:underline break-all">{reciboData.nombre || 'Recibo'}</a>
                          {reciboData.extraido && (
                            <div className="text-xs text-gray-600 mt-1">
                              {reciboData.extraido.medioPago && <span>{reciboData.extraido.medioPago} · </span>}
                              {reciboData.extraido.monto && <span>${Number(reciboData.extraido.monto).toLocaleString('es-CO')} · </span>}
                              {reciboData.extraido.fecha && <span>{reciboData.extraido.fecha}</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg p-4 text-center">Sin recibo aún.</div>
                      )}
                    </section>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setDocModal(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </PermissionGuard>
    </DashboardLayout>
  )
}
