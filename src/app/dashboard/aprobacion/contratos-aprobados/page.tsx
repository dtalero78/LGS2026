'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AprobacionPermission } from '@/types/permissions'
import { exportToExcel } from '@/lib/export-excel'
import { User, Filter, Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface Contrato {
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
  _createdDate: Date
  fechaIngreso?: string | Date | null
  categoria?: 'Aprobados' | 'Inactivos' | 'Finalizados'
}

interface FilterState {
  categoria: string
  plataforma: string
  fechaInicio: Date | null
  fechaFin: Date | null
}

// Opciones del dropdown (según requerimiento).
const CATEGORIAS = [
  { value: '', label: 'Todos' },
  { value: 'Aprobados', label: 'Aprobados' },
  { value: 'Inactivos', label: 'Inactivos' },
  { value: 'Finalizados', label: 'Finalizados' },
]

const RECORDS_PER_PAGE = 10

// Color del badge de estado
function estadoBadge(estado?: string) {
  switch ((estado || '').toUpperCase()) {
    case 'ACTIVA': return 'bg-green-100 text-green-800'
    case 'INACTIVA': return 'bg-gray-200 text-gray-800'
    case 'FINALIZADA': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString() : ''

export default function ContratosAprobadosPage() {
  const [allContratos, setAllContratos] = useState<Contrato[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [searchApellido, setSearchApellido] = useState('')
  const [filters, setFilters] = useState<FilterState>({ categoria: 'Aprobados', plataforma: '', fechaInicio: null, fechaFin: null })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const loadContratos = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/postgres/approvals/contratos-aprobados', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.approvals) {
          setAllContratos(result.approvals)
        } else {
          setAllContratos([])
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar contratos aprobados:', error)
      setAllContratos([])
    } finally {
      setLoading(false)
    }
  }

  const getFilteredData = (): Contrato[] => {
    let data = [...allContratos]

    if (searchApellido.trim()) {
      const t = searchApellido.toLowerCase().trim()
      data = data.filter(c => {
        const ap = `${c.primerApellido || ''} ${c.segundoApellido || ''}`.toLowerCase()
        const nom = `${c.primerNombre || ''} ${c.primerApellido || ''}`.toLowerCase()
        return ap.includes(t) || nom.includes(t)
      })
    }
    if (filters.categoria) {
      data = data.filter(c => c.categoria === filters.categoria)
    }
    if (filters.plataforma) {
      const p = filters.plataforma.toLowerCase().trim()
      data = data.filter(c => (c.plataforma || '').toLowerCase().trim() === p)
    }
    if (filters.fechaInicio) {
      data = data.filter(c => new Date(c._createdDate) >= filters.fechaInicio!)
    }
    if (filters.fechaFin) {
      const ff = new Date(filters.fechaFin)
      ff.setHours(23, 59, 59, 999)
      data = data.filter(c => new Date(c._createdDate) <= ff)
    }
    return data
  }

  const updatePagination = (data: Contrato[]) => {
    setTotalPages(Math.ceil(data.length / RECORDS_PER_PAGE))
    setCurrentPage(1)
    setContratos(data.slice(0, RECORDS_PER_PAGE))
  }

  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    setCurrentPage(newPage)
    const start = (newPage - 1) * RECORDS_PER_PAGE
    setContratos(getFilteredData().slice(start, start + RECORDS_PER_PAGE))
  }

  useEffect(() => { loadContratos() }, [])

  useEffect(() => {
    updatePagination(getFilteredData())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContratos, searchApellido, filters.categoria, filters.plataforma, filters.fechaInicio, filters.fechaFin])

  const filteredCount = getFilteredData().length

  // Opciones de plataforma derivadas de los datos cargados (distintas, ordenadas).
  const plataformaOptions = Array.from(
    new Set(allContratos.map(c => (c.plataforma || '').trim()).filter(Boolean))
  ).sort()

  return (
    <DashboardLayout>
      <PermissionGuard permission={AprobacionPermission.CONTRATOS_APROBADOS_VER} showDefaultMessage>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">✅ Contratos Aprobados</h1>
              <p className="mt-2 text-sm text-gray-700">
                Contratos ya decididos: aprobados vigentes, inactivos y finalizados
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => exportToExcel(getFilteredData(), [
                  { header: 'Titular', accessor: (c) => `${c.primerNombre} ${c.primerApellido}`.trim() },
                  { header: 'Documento', accessor: (c) => c.numeroId },
                  { header: 'Contrato', accessor: (c) => c.contrato },
                  { header: 'Plataforma', accessor: (c) => c.plataforma },
                  { header: 'Fecha Contrato', accessor: (c) => fmtDate(c._createdDate) },
                  { header: 'Celular', accessor: (c) => c.celular },
                  { header: 'Email', accessor: (c) => c.email },
                  { header: 'Estado', accessor: (c) => c.estado || '' },
                  { header: 'Categoría', accessor: (c) => c.categoria || '' },
                  { header: 'Fecha Aprobación', accessor: (c) => fmtDate(c.fechaIngreso) },
                ], `contratos-aprobados-${new Date().toISOString().split('T')[0]}`)}
                disabled={filteredCount === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
              <button
                type="button"
                onClick={() => loadContratos()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Actualizar
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-3">
                <label htmlFor="searchApellido" className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar por apellido o nombre
                </label>
                <input
                  type="text"
                  id="searchApellido"
                  placeholder="Apellido o nombre..."
                  value={searchApellido}
                  onChange={(e) => setSearchApellido(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={filters.categoria}
                  onChange={(e) => setFilters(prev => ({ ...prev, categoria: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CATEGORIAS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                <select
                  value={filters.plataforma}
                  onChange={(e) => setFilters(prev => ({ ...prev, plataforma: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todas</option>
                  {plataformaOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rango de fechas</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.fechaInicio ? filters.fechaInicio.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-')
                        setFilters(prev => ({ ...prev, fechaInicio: new Date(+y, +m - 1, +d, 0, 0, 0, 0) }))
                      } else setFilters(prev => ({ ...prev, fechaInicio: null }))
                    }}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="date"
                    value={filters.fechaFin ? filters.fechaFin.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-')
                        setFilters(prev => ({ ...prev, fechaFin: new Date(+y, +m - 1, +d, 0, 0, 0, 0) }))
                      } else setFilters(prev => ({ ...prev, fechaFin: null }))
                    }}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Resultados + paginación */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Registros filtrados ({filteredCount})</h2>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}
                  className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm">{currentPage} de {totalPages}</span>
                <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}
                  className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="card p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando contratos...</p>
            </div>
          ) : contratos.length === 0 ? (
            <div className="card p-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay contratos</h3>
              <p className="text-gray-500">No se encontraron contratos con los filtros aplicados</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titular</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Contrato</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Aprobación</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {contratos.map(contrato => (
                      <tr
                        key={contrato._id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => window.open(`/person/${contrato._id}`, '_blank')}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{contrato.primerNombre} {contrato.primerApellido}</div>
                              <div className="text-sm text-gray-500">{contrato.numeroId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{contrato.contrato}</div>
                          <div className="text-sm text-gray-500">{contrato.plataforma}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {fmtDate(contrato._createdDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{contrato.celular}</div>
                          <div className="text-sm text-gray-500">{contrato.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoBadge(contrato.estado)}`}>
                            {contrato.estado || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {fmtDate(contrato.fechaIngreso)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
