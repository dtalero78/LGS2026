'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ServicioPermission } from '@/types/permissions'
import { formatDateTime } from '@/lib/utils'

interface WelcomeEvent {
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
  advisor?: string
  plataforma?: string
  totalSesionesWelcome?: number
}

export default function WelcomeSessionPage() {
  const [welcomeEvents, setWelcomeEvents] = useState<WelcomeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estados para filtros
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'attended' | 'not-attended'>('all')
  const [searchApellido, setSearchApellido] = useState('')

  const loadWelcomeEvents = async () => {
    setLoading(true)
    setError(null)

    try {
      // Preparar parámetros de fecha si están definidos
      const requestBody: { fechaInicio?: string; fechaFin?: string } = {}

      if (startDate) {
        requestBody.fechaInicio = startDate
      }

      if (endDate) {
        // Sumar un día a fechaFin para incluir todo el día seleccionado
        // Porque el backend filtra fechaEvento < fechaFin (no <=)
        const endDateObj = new Date(endDate)
        endDateObj.setDate(endDateObj.getDate() + 1)
        requestBody.fechaFin = endDateObj.toISOString().split('T')[0]
      }

      const hasDateFilter = startDate || endDate
      const logMessage = hasDateFilter
        ? `🔍 Cargando eventos WELCOME desde ${startDate || 'inicio'} hasta ${endDate || 'fin'}...`
        : '🔍 Cargando eventos WELCOME... (esto puede tardar hasta 30 segundos)'

      console.log(logMessage)

      // Crear un AbortController con timeout de 90 segundos
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000)

      const response = await fetch('/api/wix-proxy/welcome-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ Eventos WELCOME recibidos:', data)

      if (data.success && data.events) {
        setWelcomeEvents(data.events)

        // Debug: Mostrar fechas únicas de los eventos
        const uniqueDates = [...new Set(data.events.map((e: WelcomeEvent) => {
          const d = new Date(e.fechaEvento)
          return d.toLocaleDateString('es-CO')
        }))].sort()
        console.log('📅 Fechas únicas en eventos:', uniqueDates)
      } else {
        throw new Error(data.error || 'Error al cargar eventos')
      }

    } catch (error) {
      console.error('❌ Error cargando eventos WELCOME:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Función para filtrar y ordenar eventos
  // El filtro de fecha ahora se hace en el backend, solo filtramos por apellido y asistencia
  const filteredEvents = welcomeEvents
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

  console.log(`📊 Total eventos: ${welcomeEvents.length}, Filtrados: ${filteredEvents.length}`)

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setAttendanceFilter('all')
    setSearchApellido('')
  }

  const handleRowClick = (event: WelcomeEvent) => {
    console.log('🔍 Evento seleccionado:', event)
    if (event.idEstudiante) {
      // Navegar directamente usando el idEstudiante (que es el _id del registro ACADEMICA)
      console.log('🔗 Navegando a estudiante:', event.idEstudiante)
      window.location.href = `/student/${event.idEstudiante}`
    } else {
      console.log('⚠️ No se encontró idEstudiante para el evento:', event.numeroId)
    }
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={ServicioPermission.WELCOME_CARGAR_EVENTOS}>
        <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📅 Eventos WELCOME</h1>
        </div>

        <div className="card">
          <div className="card-header pb-6">
            <div className="flex items-center justify-end">
              <button
                onClick={loadWelcomeEvents}
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
                    Cargar Eventos
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
                Mostrando {filteredEvents.length} de {welcomeEvents.length} eventos
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
                      <th className="table-header-cell">Sesiones</th>
                      <th className="table-header-cell">Asistencia</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {filteredEvents.length > 0 ? (
                      filteredEvents.map((event) => (
                        <tr
                          key={event._id}
                          onClick={() => handleRowClick(event)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                        >
                          <td className="table-cell">
                            <div className="text-sm font-medium text-gray-900">
                              {`${event.primerNombre} ${event.primerApellido}`.trim()}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="text-sm text-gray-500">
                              {event.celular || 'N/A'}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="text-sm text-gray-500">
                              {formatDateTime(event.fechaEvento)}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="text-sm font-semibold text-blue-600">
                              {event.totalSesionesWelcome || 0}
                            </div>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${
                              event.asistencia === true ? 'badge-success' :
                              event.asistencia === false ? 'badge-danger' :
                              new Date(event.fechaEvento) > new Date() ? 'badge-warning' : 'badge-danger'
                            }`}>
                              {event.asistencia === true ? 'Asistió' :
                               event.asistencia === false ? 'No asistió' :
                               new Date(event.fechaEvento) > new Date() ? 'Pendiente' : 'No asistió'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : !loading ? (
                      <tr>
                        <td colSpan={5} className="table-cell text-center py-8">
                          <div className="text-gray-500">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay eventos WELCOME</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {welcomeEvents.length > 0
                                ? "No hay eventos que coincidan con los filtros aplicados."
                                : "Haz clic en 'Cargar Eventos' para buscar eventos de bienvenida recientes"
                              }
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="table-cell text-center py-8">
                          <div className="flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-2 text-sm text-gray-500">Cargando eventos...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {welcomeEvents.length > 0 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Total: {welcomeEvents.length} evento{welcomeEvents.length !== 1 ? 's' : ''} WELCOME encontrado{welcomeEvents.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}