'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface CalendarEvent {
  _id: string
  dia: Date
  evento: 'SESSION' | 'CLUB' | 'WELCOME'
  tituloONivel: string
  nombreEvento?: string
  advisor: string
  observaciones?: string
  limiteUsuarios: number
  linkZoom?: string
}

interface Advisor {
  _id: string
  primerNombre: string
  primerApellido: string
  zoom?: string
}

interface Nivel {
  _id: string
  code: string
  step: string
  clubs?: string[]
}

interface EventModalProps {
  isOpen: boolean
  editingEvent: CalendarEvent | null
  advisors: Advisor[]
  onSave: (eventData: any) => void
  onClose: () => void
}

export default function EventModal({
  isOpen,
  editingEvent,
  advisors,
  onSave,
  onClose
}: EventModalProps) {
  // Estados del formulario
  const [tipoEvento, setTipoEvento] = useState<'SESSION' | 'CLUB' | 'WELCOME'>('SESSION')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('8')
  const [advisorId, setAdvisorId] = useState('')
  const [nivel, setNivel] = useState('')
  const [step, setStep] = useState('')
  const [nombreEvento, setNombreEvento] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [limiteUsuarios, setLimiteUsuarios] = useState(7)
  const [linkZoom, setLinkZoom] = useState('')

  // Estados auxiliares
  const [availableSteps, setAvailableSteps] = useState<string[]>([])
  const [availableClubs, setAvailableClubs] = useState<string[]>([])
  const [uniqueNiveles, setUniqueNiveles] = useState<string[]>([])

  // Inicializar formulario
  useEffect(() => {
    if (editingEvent) {
      // Modo edición
      setTipoEvento(editingEvent.evento)
      setFecha(format(new Date(editingEvent.dia), 'yyyy-MM-dd'))
      setHora(new Date(editingEvent.dia).getHours().toString())
      setAdvisorId(editingEvent.advisor)
      setNivel(editingEvent.tituloONivel)
      setNombreEvento(editingEvent.nombreEvento || '')
      setObservaciones(editingEvent.observaciones || '')
      setLimiteUsuarios(editingEvent.limiteUsuarios)
      setLinkZoom(editingEvent.linkZoom || '')
    } else if (isOpen) {
      // Modo creación - usar fecha actual
      const currentDate = new Date()
      setFecha(format(currentDate, 'yyyy-MM-dd'))
      setTipoEvento('SESSION')
      setLimiteUsuarios(7)
      setAdvisorId('')
      setNivel('')
      setNombreEvento('')
      setObservaciones('')
      setLinkZoom('')
    }
  }, [editingEvent, isOpen])

  // Niveles disponibles (hardcoded por ahora)
  useEffect(() => {
    setUniqueNiveles(['BEGINNER 1', 'BEGINNER 2', 'INTERMEDIATE 1', 'INTERMEDIATE 2', 'ADVANCED 1', 'ADVANCED 2', 'WELCOME'])
  }, [])

  // Steps disponibles simplificados
  useEffect(() => {
    if (nivel) {
      const steps = ['Step 1', 'Step 2', 'Step 3', 'Step 4']
      setAvailableSteps(steps)

      // Si es CLUB, usar el primer step
      if (tipoEvento === 'CLUB' && steps.length > 0) {
        setStep(steps[0])
      }
    }
  }, [nivel, tipoEvento])

  // Clubs disponibles simplificados
  useEffect(() => {
    if (tipoEvento === 'CLUB' && nivel && step) {
      const clubs = ['Club A', 'Club B', 'Club C', 'Club D']
      setAvailableClubs(clubs)
      if (clubs.length > 0 && !nombreEvento) {
        setNombreEvento(clubs[0])
      }
    }
  }, [step, nivel, tipoEvento, nombreEvento])

  // Actualizar zoom cuando cambia el advisor
  useEffect(() => {
    if (advisorId) {
      const advisor = advisors.find(a => a._id === advisorId)
      if (advisor?.zoom) {
        setLinkZoom(advisor.zoom)
      }
    }
  }, [advisorId, advisors])

  // Actualizar límite de usuarios según tipo de evento
  useEffect(() => {
    if (!editingEvent) {
      setLimiteUsuarios(tipoEvento === 'SESSION' ? 7 : 20)
    }
  }, [tipoEvento, editingEvent])

  // Función para obtener label del step
  const getStepLabel = (stepValue: string) => {
    const stepNum = parseInt(stepValue.replace('Step ', ''))
    if ([5, 10, 15, 20, 25, 30].includes(stepNum)) {
      return `${stepValue} - Jump!`
    }
    return stepValue
  }

  // Manejar submit del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!advisorId) {
      alert('Por favor selecciona un advisor')
      return
    }

    if (!nivel) {
      alert('Por favor selecciona un nivel')
      return
    }

    if (!fecha || !hora) {
      alert('Por favor selecciona fecha y hora')
      return
    }

    // Construir fecha y hora completa
    const fechaHora = new Date(`${fecha}T${hora.padStart(2, '0')}:00:00`)

    // Preparar datos del evento
    const eventData = {
      dia: fechaHora.toISOString(),
      evento: tipoEvento,
      tituloONivel: nivel,
      nombreEvento: tipoEvento === 'SESSION' ? step : nombreEvento,
      advisor: advisorId,
      observaciones,
      limiteUsuarios,
      linkZoom
    }

    onSave(eventData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="relative bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {event ? 'Editar Evento' : 'Crear Nuevo Evento'}
              </h3>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Tipo de Evento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Evento
              </label>
              <select
                value={tipoEvento}
                onChange={(e) => setTipoEvento(e.target.value as any)}
                className="w-full rounded-md border-gray-300 shadow-sm"
                required
              >
                <option value="SESSION">SESSION</option>
                <option value="CLUB">CLUB</option>
                <option value="WELCOME">WELCOME</option>
              </select>
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora
                </label>
                <select
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  required
                >
                  {Array.from({ length: 17 }, (_, i) => i + 6).map(h => (
                    <option key={h} value={h}>
                      {`${h.toString().padStart(2, '0')}:00`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advisor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Advisor
              </label>
              <select
                value={advisorId}
                onChange={(e) => setAdvisorId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm"
                required
              >
                <option value="">Seleccionar advisor...</option>
                {advisors.map(advisor => (
                  <option key={advisor._id} value={advisor._id}>
                    {advisor.primerNombre} {advisor.primerApellido}
                  </option>
                ))}
              </select>
            </div>

            {/* Nivel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel
              </label>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm"
                required
              >
                <option value="">Seleccionar nivel...</option>
                {uniqueNiveles.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            {/* Step (para SESSION) */}
            {tipoEvento === 'SESSION' && availableSteps.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step
                </label>
                <select
                  value={step}
                  onChange={(e) => setStep(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  required
                >
                  <option value="">Seleccionar step...</option>
                  {availableSteps.map(s => (
                    <option key={s} value={s}>
                      {getStepLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Club (para CLUB) */}
            {tipoEvento === 'CLUB' && (
              <>
                {availableSteps.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Step del Club
                    </label>
                    <select
                      value={step}
                      onChange={(e) => setStep(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm"
                      required
                    >
                      <option value="">Seleccionar step...</option>
                      {availableSteps.map(s => (
                        <option key={s} value={s}>
                          {getStepLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {availableClubs.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Club
                    </label>
                    <select
                      value={nombreEvento}
                      onChange={(e) => setNombreEvento(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm"
                      required
                    >
                      <option value="">Seleccionar club...</option>
                      {availableClubs.map(club => (
                        <option key={club} value={club}>
                          {club}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Límite de usuarios */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Límite de Usuarios
              </label>
              <input
                type="number"
                value={limiteUsuarios}
                onChange={(e) => setLimiteUsuarios(parseInt(e.target.value))}
                min="1"
                max="50"
                className="w-full rounded-md border-gray-300 shadow-sm"
                required
              />
            </div>

            {/* Link de Zoom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link de Zoom
              </label>
              <input
                type="url"
                value={linkZoom}
                onChange={(e) => setLinkZoom(e.target.value)}
                placeholder="https://zoom.us/..."
                className="w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 justify-between pt-4">
              <div>
                {editingEvent && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingEvent ? 'Actualizar' : 'Crear'} Evento
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}