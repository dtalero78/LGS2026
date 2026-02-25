'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ServicioPermission } from '@/types/permissions'
import { formatDateTime } from '@/lib/utils'
import { exportToExcel } from '@/lib/export-excel'

interface ClassSession {
  _id: string
  primerNombre: string
  primerApellido: string
  segundoNombre?: string
  segundoApellido?: string
  celular: string
  fechaEvento: string
  asistencia?: boolean
  numeroId: string
  idEstudiante: string
  nivel?: string
  step?: string
  advisor?: string
  plataforma?: string
}

export default function ListaSesionesPage() {
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estados para filtros
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'attended' | 'not-attended'>('all')
  const [searchApellido, setSearchApellido] = useState('')

  const loadSessions = async () => {
    setLoading(true)
    setError(null)

    try {
      // Build query params for GET request
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const hasDateFilter = startDate || endDate
      const logMessage = hasDateFilter
        ? `🔍 Cargando sesiones desde ${startDate || 'inicio'} hasta ${endDate || 'fin'}...`
        : '🔍 Cargando todas las sesiones... (esto puede tardar hasta 30 segundos)'

      console.log(logMessage)

      // Crear un AbortController con timeout de 90 segundos
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000)

      const qs = params.toString()
      const response = await fetch(`/api/postgres/events/sessions${qs ? `?${qs}` : ''}`, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ Sesiones recibidas:', data)

      if (data.success && data.events) {
        setSessions(data.events)

        // Debug: Mostrar fechas únicas de las sesiones
        const uniqueDates = [...new Set(data.events.map((e: ClassSession) => {
          const d = new Date(e.fechaEvento)
          return d.toLocaleDateString('es-CO')
        }))].sort()
        console.log('📅 Fechas únicas en sesiones:', uniqueDates)
      } else {
        throw new Error(data.error || 'Error al cargar sesiones')
      }

    } catch (error) {
      console.error('❌ Error cargando sesiones:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Función para filtrar y ordenar sesiones
  // El filtro de fecha ahora se hace en el backend, solo filtramos por apellido y asistencia
  const filteredEvents = sessions
    .filter((event) => {
      // Filtro por apellido
      if (searchApellido.trim()) {
        const apellidoCompleto = `${event.primerApellido || ''} ${event.segundoApellido || ''}`.toLowerCase()
        if (!apellidoCompleto.includes(searchApellido.toLowerCase().trim())) {
          return false
        }
      }

      // Filtro por asistencia
      if (attendanceFilter === 'attended' && event.asistencia !== true) {
        return false
      }
      if (attendanceFilter === 'not-attended') {
        // No asistió = asistencia false OR (asistencia undefined Y fecha ya pasó)
        const eventHasPassed = new Date(event.fechaEvento) <= new Date()
        if (!(event.asistencia === false || (event.asistencia === undefined && eventHasPassed))) {
          return false
        }
      }

      return true
    })
    .sort((a, b) => {
      // Ordenar por fecha más reciente primero (descendente)
      const dateA = new Date(a.fechaEvento).getTime()
      const dateB = new Date(b.fechaEvento).getTime()
      return dateB - dateA
    })

  console.log(`📊 Total sesiones: ${sessions.length}, Filtradas: ${filteredEvents.length}`)

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setAttendanceFilter('all')
    setSearchApellido('')
  }

  const handleRowClick = (session: ClassSession) => {
    console.log('🔍 Sesión seleccionada:', session)
    if (session.idEstudiante) {
      // Abrir en una nueva pestaña
      console.log('🔗 Abriendo estudiante en nueva pestaña:', session.idEstudiante)
      window.open(`/student/${session.idEstudiante}`, '_blank')
    } else {
      console.log('⚠️ No se encontró idEstudiante para la sesión:', session.numeroId)
    }
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={ServicioPermission.SESIONES_CARGAR_EVENTOS}>
        <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 Lista de Sesiones</h1>
        </div>

        <div className="card">
          <div className="card-header pb-6">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => exportToExcel(filteredEvents, [
                  { header: 'Nombre', accessor: (e) => `${e.primerNombre} ${e.primerApellido}`.trim() },
                  { header: 'Celular', accessor: (e) => e.celular || '' },
                  { header: 'Fecha Evento', accessor: (e) => formatDateTime(e.fechaEvento) },
                  { header: 'Step', accessor: (e) => e.step || 'N/A' },
                  { header: 'Asistencia', accessor: (e) => e.asistencia === true ? 'Asistió' : e.asistencia === false ? 'No asistió' : new Date(e.fechaEvento) > new Date() ? 'Pendiente' : 'No asistió' },
                ], `lista-sesiones-${new Date().toISOString().split('T')[0]}`)}
                disabled={filteredEvents.length === 0}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar Excel
              </button>
              <button
                onClick={loadSessions}
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
                    Cargar Sesiones
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
                  <label htmlFor="searchApellido" className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar por apellido
                  </label>
                  <input
                    type="text"
                    id="searchApellido"
                    value={searchApellido}
                    onChange={(e) => setSearchApellido(e.target.value)}
                    placeholder="Apellido..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha desde
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha hasta
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="attendanceFilter" className="block text-sm font-medium text-gray-700 mb-1">
                    Asistencia
                  </label>
                  <select
                    id="attendanceFilter"
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value as 'all' | 'attended' | 'not-attended')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">Todos</option>
                    <option value="attended">Asistió</option>
                    <option value="not-attended">No asistió</option>
                  </select>
                </div>

                <div>
                  <button
                    onClick={clearFilters}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-600">
                Mostrando {filteredEvents.length} de {sessions.length} sesiones
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
                    <h3 className="text-sm font-medium text-red-800">Error al cargar eventos</h3>
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
                      <th className="table-header-cell">Fecha Evento</th>
                      <th className="table-header-cell">Step</th>
                      <th className="table-header-cell">Asistencia</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {filteredEvents.length > 0 ? (
                      filteredEvents.map((session) => (
                        <tr
                          key={session._id}
                          onClick={() => handleRowClick(session)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                        >
                          <td className="table-cell">
                            <div className="text-sm font-medium text-gray-900">
                              {`${session.primerNombre} ${session.primerApellido}`.trim()}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="text-sm text-gray-500">
                              {session.celular || 'N/A'}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="text-sm text-gray-500">
                              {formatDateTime(session.fechaEvento)}
                            </div>
                          </td>
                          <td className="table-cell">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              {session.step || 'N/A'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${
                              session.asistencia === true ? 'badge-success' :
                              session.asistencia === false ? 'badge-danger' :
                              new Date(session.fechaEvento) > new Date() ? 'badge-warning' : 'badge-danger'
                            }`}>
                              {session.asistencia === true ? 'Asistió' :
                               session.asistencia === false ? 'No asistió' :
                               new Date(session.fechaEvento) > new Date() ? 'Pendiente' : 'No asistió'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : !loading ? (
                      <tr>
                        <td colSpan={6} className="table-cell text-center py-8">
                          <div className="text-gray-500">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay sesiones</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {sessions.length > 0
                                ? "No hay sesiones que coincidan con los filtros aplicados."
                                : "Haz clic en 'Cargar Sesiones' para buscar todas las sesiones"
                              }
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="table-cell text-center py-8">
                          <div className="flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <div className="ml-3 text-center">
                              <span className="text-sm font-medium text-gray-700">Cargando todas las sesiones...</span>
                              <p className="text-xs text-gray-500 mt-1">Esto puede tardar hasta 30 segundos. Por favor espera.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {sessions.length > 0 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Total: {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} encontrada{sessions.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}