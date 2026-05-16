'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ServicioPermission } from '@/types/permissions'
import { exportToExcel } from '@/lib/export-excel'

interface ExamInternStudent {
  _id: string
  numeroId: string | null
  primerNombre: string | null
  segundoNombre: string | null
  primerApellido: string | null
  segundoApellido: string | null
  celular: string | null
  email: string | null
  plataforma: string | null
  pruebainter: string | null
  nivel: string | null
  step: string | null
  fechaPromocionEspecial: string | null
}

function fullName(s: ExamInternStudent): string {
  return [s.primerNombre, s.segundoNombre, s.primerApellido, s.segundoApellido]
    .filter(Boolean)
    .join(' ')
    .trim()
}

export default function IeltsPage() {
  const [students, setStudents] = useState<ExamInternStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [search, setSearch]         = useState('')
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [plataforma, setPlataforma] = useState('')

  const loadStudents = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ prueba: 'IELTS' })
      if (search.trim()) params.set('search', search.trim())
      if (startDate)     params.set('startDate', startDate)
      if (endDate)       params.set('endDate', endDate)
      if (plataforma)    params.set('plataforma', plataforma)

      const res = await fetch(`/api/postgres/servicio/exam-intern?${params.toString()}`)
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.students)) {
        setStudents(data.students)
      } else {
        throw new Error(data.error || 'Respuesta inválida del servidor')
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Carga inicial
  useEffect(() => {
    loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    setPlataforma('')
  }

  const plataformasDistinct = Array.from(
    new Set(students.map(s => s.plataforma).filter((p): p is string => !!p))
  ).sort()

  const handleExportCSV = () => {
    exportToExcel(students, [
      { header: 'Nombre Completo', accessor: s => fullName(s) },
      { header: 'Número ID',       accessor: s => s.numeroId || '' },
      { header: 'Celular',         accessor: s => s.celular || '' },
      { header: 'Email',           accessor: s => s.email || '' },
      { header: 'Plataforma',      accessor: s => s.plataforma || '' },
    ], `ielts-${new Date().toISOString().split('T')[0]}`)
  }

  const handleRowClick = (s: ExamInternStudent) => {
    if (s._id) window.open(`/student/${s._id}`, '_blank')
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={ServicioPermission.EXAM_INTERN_IELTS_VER}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🎓 Exam. Intern. — IELTS</h1>
            <p className="text-sm text-gray-500 mt-1">
              Estudiantes con <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">pruebainter = IELTS</code> o <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">step = Step 47</code>
            </p>
          </div>

          <div className="card">
            <div className="card-header pb-6">
              <div className="flex items-center justify-end gap-3">
                <PermissionGuard permission={ServicioPermission.EXAM_INTERN_IELTS_EXPORTAR}>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={students.length === 0}
                    className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar CSV
                  </button>
                </PermissionGuard>
                <button
                  type="button"
                  onClick={loadStudents}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Cargando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Aplicar filtros
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="card-content">
              {/* Filtros */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                      Buscar por apellido o ID
                    </label>
                    <input
                      type="text"
                      id="search"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Apellido o número de ID..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Promoción desde
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Promoción hasta
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="plataforma" className="block text-sm font-medium text-gray-700 mb-1">
                      Plataforma
                    </label>
                    <select
                      id="plataforma"
                      value={plataforma}
                      onChange={e => setPlataforma(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Todas</option>
                      {plataformasDistinct.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-600">
                  {students.length} estudiante{students.length !== 1 ? 's' : ''}
                </div>
              </div>

              {error ? (
                <div className="alert alert-error">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error al cargar estudiantes</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead className="table-header">
                      <tr>
                        <th className="table-header-cell">Nombre Completo</th>
                        <th className="table-header-cell">Celular</th>
                        <th className="table-header-cell">Email</th>
                        <th className="table-header-cell">Plataforma</th>
                      </tr>
                    </thead>
                    <tbody className="table-body">
                      {students.length > 0 ? (
                        students.map(s => (
                          <tr
                            key={s._id}
                            onClick={() => handleRowClick(s)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                          >
                            <td className="table-cell">
                              <div className="text-sm font-medium text-gray-900">{fullName(s) || 'Sin nombre'}</div>
                              {s.numeroId && (
                                <div className="text-xs text-gray-500">ID: {s.numeroId}</div>
                              )}
                            </td>
                            <td className="table-cell">
                              <div className="text-sm text-gray-500">{s.celular || 'N/A'}</div>
                            </td>
                            <td className="table-cell">
                              <div className="text-sm text-gray-500">{s.email || 'N/A'}</div>
                            </td>
                            <td className="table-cell">
                              <div className="text-sm text-gray-500">{s.plataforma || 'N/A'}</div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-sm text-gray-500">
                            {loading ? 'Cargando...' : 'No hay usuarios para la prueba IELTS.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
