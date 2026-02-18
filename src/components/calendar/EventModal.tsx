'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface CalendarEvent {
  _id: string
  dia: Date
  evento?: 'SESSION' | 'CLUB' | 'WELCOME'
  tipo?: string
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
  steps: string[]
  clubs: string[]
}

interface StepOption {
  value: string
  label: string
}

interface ClubOption {
  value: string
  label: string
}

interface EventModalProps {
  isOpen: boolean
  editingEvent: CalendarEvent | null
  advisors: Advisor[]
  selectedDate?: Date | null
  onSave: (eventData: any) => void
  onClose: () => void
}

export default function EventModal({
  isOpen,
  editingEvent,
  advisors,
  selectedDate,
  onSave,
  onClose
}: EventModalProps) {
  const [formData, setFormData] = useState({
    fecha: '',
    hora: '',
    evento: 'SESSION' as 'SESSION' | 'CLUB' | 'WELCOME',
    tituloONivel: '',
    nombreEvento: '',
    advisor: '',
    observaciones: '',
    limiteUsuarios: 20,
    linkZoom: '',
    clubStep: ''
  })

  const [niveles, setNiveles] = useState<Nivel[]>([])
  const [codigosNivel, setCodigosNivel] = useState<string[]>([])
  const [stepOptions, setStepOptions] = useState<StepOption[]>([])
  const [clubOptions, setClubOptions] = useState<ClubOption[]>([])
  const [showClubStep, setShowClubStep] = useState(false)
  const [showNombreClub, setShowNombreClub] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [savedNombreEvento, setSavedNombreEvento] = useState('')

  // Cargar códigos únicos al montar el componente
  useEffect(() => {
    if (isOpen) {
      loadCodigosNivel()
    }
  }, [isOpen])

  // Ejecutar cargarNombreStep cuando cambia tipo de evento (si ya hay nivel)
  useEffect(() => {
    if (formData.tituloONivel) {
      cargarNombreStep()
    }
  }, [formData.evento])

  // Ejecutar cargarNombreStep cuando cambia nivel (si ya hay tipo)
  useEffect(() => {
    if (formData.evento) {
      cargarNombreStep()
    }
  }, [formData.tituloONivel])

  // Manejar cambio de tipo de evento y nivel
  useEffect(() => {
    if (formData.evento && formData.tituloONivel) {
      // Cargar opciones cuando hay tipo de evento y nivel seleccionados
      cargarNombreStep()
    } else {
      // Limpiar todo si falta información
      setShowClubStep(false)
      setShowNombreClub(false)
      setStepOptions([])
      setClubOptions([])
    }
  }, [formData.evento, formData.tituloONivel])

  // Manejar cambio de step cuando es CLUB
  useEffect(() => {
    if (formData.evento === 'CLUB' && formData.clubStep && formData.tituloONivel) {
      loadClubsPorNivelYStep(formData.tituloONivel, formData.clubStep)
    }
  }, [formData.clubStep, formData.tituloONivel, formData.evento])

  // Generar opciones de horas (6:00 AM - 10:00 PM)
  const generateHourOptions = () => {
    const hours = []
    for (let i = 6; i <= 22; i++) {
      const time24 = `${i.toString().padStart(2, '0')}:00`
      const time12 = i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`
      hours.push({ value: time24, label: time12 })
    }
    return hours
  }

  const hourOptions = generateHourOptions()

  // Inicializar formulario cuando hay un evento para editar o cuando se abre el modal
  useEffect(() => {
    if (editingEvent) {
      const eventDate = new Date(editingEvent.dia)

      // Extraer advisor ID si viene como objeto
      let advisorId = editingEvent.advisor
      if (typeof editingEvent.advisor === 'object' && editingEvent.advisor !== null) {
        advisorId = (editingEvent.advisor as any)._id
      }

      // Guardar nombreEvento antes de cargar opciones
      const nombreEventoValue = editingEvent.nombreEvento || ''
      setSavedNombreEvento(nombreEventoValue)
      setIsEditMode(true)

      setFormData({
        fecha: format(eventDate, 'yyyy-MM-dd'),
        hora: format(eventDate, 'HH:mm'),
        evento: editingEvent.evento || editingEvent.tipo,
        tituloONivel: editingEvent.tituloONivel,
        nombreEvento: nombreEventoValue,
        advisor: advisorId,
        observaciones: editingEvent.observaciones || '',
        limiteUsuarios: editingEvent.limiteUsuarios,
        linkZoom: editingEvent.linkZoom || '',
        clubStep: ''
      })

      const eventType = editingEvent.evento || editingEvent.tipo
      // Cargar opciones de step/club después de un pequeño delay para asegurar que niveles esté cargado
      setTimeout(() => {
        if (niveles.length === 0) {
          // Si niveles no está cargado, cargarlos primero
          loadCodigosNivel().then((loadedNiveles) => {
            // Luego cargar opciones de step/club con los niveles recién cargados
            if (eventType === 'SESSION' || eventType === 'CLUB') {
              cargarNombreStepForEdit(editingEvent.tituloONivel, eventType, nombreEventoValue, loadedNiveles)
            }
          })
        } else {
          // Si niveles ya está cargado, cargar directamente
          if (eventType === 'SESSION' || eventType === 'CLUB') {
            cargarNombreStepForEdit(editingEvent.tituloONivel, eventType, nombreEventoValue, niveles)
          }
        }
      }, 100)
    } else {
      // Reset form for new event
      setIsEditMode(false)
      setSavedNombreEvento('')
      const defaultDate = selectedDate || new Date()
      setFormData({
        fecha: format(defaultDate, 'yyyy-MM-dd'),
        hora: '18:00', // Default to 6:00 PM
        evento: 'SESSION',
        tituloONivel: '',
        nombreEvento: '',
        advisor: '',
        observaciones: '',
        limiteUsuarios: 20,
        linkZoom: '',
        clubStep: ''
      })
    }
  }, [editingEvent, selectedDate, isOpen])

  const loadCodigosNivel = async () => {
    try {
      const response = await fetch('/api/postgres/niveles', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        // API puede devolver "niveles" o "data" dependiendo del endpoint
        const nivelesArray = data.niveles || data.data || []
        if (data.success && nivelesArray.length > 0) {
          setNiveles(nivelesArray)
          // Extraer códigos únicos (eliminar duplicados)
          const codigos = [...new Set(nivelesArray.map((nivel: any) => nivel.code))] as string[]
          setCodigosNivel(codigos)
          console.log('✅ Niveles loaded:', nivelesArray.length, 'códigos únicos:', codigos.length)
          return nivelesArray
        }
      }
      return []
    } catch (error) {
      console.error('Error loading códigos nivel:', error)
      return []
    }
  }

  const loadStepsPorNivel = async (codigoNivel: string) => {
    try {
      // Buscar el nivel por código en el nuevo formato
      const nivelEncontrado = niveles.find(nivel => nivel.code === codigoNivel)
      if (nivelEncontrado && nivelEncontrado.steps) {
        const steps = nivelEncontrado.steps.map(step => ({
          value: step,
          label: getStepLabel(step)
        }))
        setStepOptions(steps)
        console.log('✅ Steps loaded for', codigoNivel, ':', steps.length)
      }
    } catch (error) {
      console.error('Error loading steps:', error)
    }
  }

  const loadClubsPorNivelYStep = async (codigoNivel: string, step?: string) => {
    try {
      // En el nuevo formato, los clubs están a nivel de código, no de step específico
      const nivelEncontrado = niveles.find(nivel => nivel.code === codigoNivel)
      if (nivelEncontrado && nivelEncontrado.clubs) {
        const clubs = nivelEncontrado.clubs.map(club => ({
          value: club,
          label: club
        }))
        setClubOptions(clubs)
        setShowClubStep(false)
        setShowNombreClub(true)
        console.log('✅ Clubs loaded for', codigoNivel, ':', clubs.length)
      }
    } catch (error) {
      console.error('Error loading clubs:', error)
    }
  }

  const getStepLabel = (step: string): string => {
    if (!step) return "Sin Step"

    const jumps = [5, 10, 15, 20, 25, 30, 35, 40, 45]
    const stepNumber = parseInt(step.replace("Step ", ""))

    if (jumps.includes(stepNumber)) {
      return `Jump (Step ${stepNumber})`
    } else if (!isNaN(stepNumber)) {
      return `Step ${stepNumber}`
    } else {
      return step
    }
  }

  // Función especial para cargar opciones en modo edición
  const cargarNombreStepForEdit = (nivel: string, tipoEvento: string, nombreEventoToRestore: string, nivelesData: Nivel[]) => {
    console.log("🔧 cargarNombreStepForEdit - Nivel:", nivel, "Tipo:", tipoEvento, "nombreEvento:", nombreEventoToRestore)
    console.log("🔧 Niveles disponibles:", nivelesData.length)

    if (!nivel) {
      console.log("❌ No hay nivel seleccionado")
      return
    }

    // Buscar el nivel por código en el nuevo formato estructurado
    const nivelEncontrado = nivelesData.find(n => n.code === nivel)
    console.log("🔍 Nivel encontrado:", nivelEncontrado ? nivelEncontrado.code : 'NO ENCONTRADO')

    if (nivelEncontrado) {
      let opciones: { value: string, label: string }[] = []

      if (tipoEvento === "CLUB") {
        // Si el evento es CLUB, obtener los valores del array "clubs"
        const clubs = nivelEncontrado.clubs || []
        opciones = clubs.map(club => ({
          value: club,
          label: club
        }))
        console.log("✅ Opciones de clubs cargadas:", opciones.length)
        setClubOptions(opciones)
        setShowClubStep(false)
        setShowNombreClub(true)
      } else {
        // Si no es CLUB (SESSION, WELCOME), obtener los valores de steps
        const steps = nivelEncontrado.steps || []
        opciones = steps.map(step => ({
          value: step,
          label: getStepLabel(step)
        }))
        console.log("✅ Opciones de steps cargadas:", opciones.length)
        setStepOptions(opciones)
        setShowClubStep(false)
        setShowNombreClub(true)  // Mostrar dropdown para SESSION también
      }

      // Restaurar nombreEvento después de cargar opciones
      setTimeout(() => {
        setFormData(prev => ({
          ...prev,
          nombreEvento: nombreEventoToRestore
        }))
        console.log("✅ nombreEvento restaurado:", nombreEventoToRestore)
      }, 50)
    }
  }

  // Función que replica exactamente cargarNombreStep() de CALENDARIO.js
  const cargarNombreStep = () => {
    const nivelSeleccionado = formData.tituloONivel
    const tipoEventoSeleccionado = formData.evento

    console.log("Nivel seleccionado:", nivelSeleccionado)
    console.log("Tipo de evento seleccionado:", tipoEventoSeleccionado)

    if (!nivelSeleccionado) return

    // Buscar el nivel por código en el nuevo formato estructurado
    const nivelEncontrado = niveles.find(nivel => nivel.code === nivelSeleccionado)

    if (nivelEncontrado) {
      let opciones: { value: string, label: string }[] = []

      if (tipoEventoSeleccionado === "CLUB") {
        // Si el evento es CLUB, obtener los valores del array "clubs"
        const clubs = nivelEncontrado.clubs || []
        opciones = clubs.map(club => ({
          value: club,
          label: club
        }))
        console.log("Opciones cargadas desde clubs:", opciones)
        setClubOptions(opciones)
        setShowClubStep(false)
        setShowNombreClub(true)
      } else {
        // Si no es CLUB (SESSION, WELCOME), obtener los valores de steps
        const steps = nivelEncontrado.steps || []
        opciones = steps.map(step => ({
          value: step,
          label: getStepLabel(step)
        }))
        console.log("Opciones cargadas desde steps:", opciones)
        setStepOptions(opciones)
        setShowClubStep(false)
        setShowNombreClub(true)  // Mostrar dropdown para SESSION también
      }

      // NO limpiar nombreEvento si estamos en modo edición
      if (!isEditMode) {
        setFormData(prev => ({
          ...prev,
          nombreEvento: ''
        }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validaciones básicas
      if (!formData.fecha || !formData.hora || !formData.tituloONivel || !formData.advisor) {
        setError('Todos los campos obligatorios deben estar completos')
        return
      }

      // Combinar fecha y hora para crear la fecha completa
      const dateTimeString = `${formData.fecha}T${formData.hora}:00`
      const eventDateTime = new Date(dateTimeString)

      // Preparar datos para enviar
      const eventData = {
        dia: eventDateTime.toISOString(),
        evento: formData.evento,
        tituloONivel: formData.tituloONivel,
        nombreEvento: formData.nombreEvento || undefined,
        advisor: formData.advisor,
        observaciones: formData.observaciones || undefined,
        limiteUsuarios: Number(formData.limiteUsuarios),
        linkZoom: formData.linkZoom || undefined
      }

      onSave(eventData)
    } catch (error) {
      console.error('Error saving event:', error)
      setError('Error al guardar el evento')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Manejar cambios específicos
    if (field === 'advisor' && value) {
      // Auto-llenar zoom del advisor
      const selectedAdvisor = advisors.find(advisor => advisor._id === value)
      const advisorZoom = selectedAdvisor?.zoom || ''

      console.log('📹 Advisor seleccionado:', selectedAdvisor?.primerNombre, selectedAdvisor?.primerApellido)
      console.log('📹 Zoom link encontrado:', advisorZoom)

      setFormData(prev => ({
        ...prev,
        advisor: value,
        linkZoom: advisorZoom
      }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="relative bg-gray-50 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white rounded-t-lg mx-4 mt-4">
            <h3 className="text-lg font-medium text-gray-900">
              {editingEvent ? 'Editar Evento' : 'Crear Nuevo Evento'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg mx-4 mb-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="text-red-500 text-sm">{error}</div>
                </div>
              </div>
            )}

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => handleInputChange('fecha', e.target.value)}
                className="input w-full"
                required
              />
            </div>

            {/* Hora */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora *
              </label>
              <select
                value={formData.hora}
                onChange={(e) => handleInputChange('hora', e.target.value)}
                className="input w-full"
                required
              >
                <option value="">Seleccionar hora</option>
                {hourOptions.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Evento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Evento *
              </label>
              <select
                value={formData.evento}
                onChange={(e) => handleInputChange('evento', e.target.value)}
                className="input w-full"
                required
              >
                <option value="SESSION">Sesión</option>
                <option value="CLUB">Club</option>
                <option value="WELCOME">Welcome Event</option>
              </select>
            </div>

            {/* Título/Nivel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.evento === 'SESSION' || formData.evento === 'CLUB' ? 'Nivel' : 'Título'} *
              </label>
              {formData.evento === 'SESSION' || formData.evento === 'CLUB' ? (
                <select
                  value={formData.tituloONivel}
                  onChange={(e) => handleInputChange('tituloONivel', e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Seleccionar nivel</option>
                  {codigosNivel.map((codigo) => (
                    <option key={codigo} value={codigo}>
                      {codigo}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.tituloONivel}
                  onChange={(e) => handleInputChange('tituloONivel', e.target.value)}
                  className="input w-full"
                  placeholder="Título del evento"
                  required
                />
              )}
            </div>

            {/* Club Step (solo para CLUB) */}
            {showClubStep && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step *
                </label>
                <select
                  value={formData.clubStep}
                  onChange={(e) => handleInputChange('clubStep', e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Seleccionar step</option>
                  {stepOptions.map((step) => (
                    <option key={step.value} value={step.value}>
                      {step.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Nombre del Evento (dinámico según tipo) */}
            {(formData.evento === 'SESSION' || formData.evento === 'CLUB') && formData.tituloONivel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.evento === 'CLUB' ? 'Club' : 'Step'} *
                </label>
                <select
                  value={formData.nombreEvento}
                  onChange={(e) => handleInputChange('nombreEvento', e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">
                    {formData.evento === 'CLUB' ? 'Seleccionar club' : 'Seleccionar step'}
                  </option>
                  {formData.evento === 'CLUB'
                    ? clubOptions.map((club) => (
                        <option key={club.value} value={club.value}>
                          {club.label}
                        </option>
                      ))
                    : stepOptions.map((step) => (
                        <option key={step.value} value={step.value}>
                          {step.label}
                        </option>
                      ))
                  }
                </select>
              </div>
            )}

            {/* Nombre del Evento manual (solo para WELCOME) */}
            {formData.evento === 'WELCOME' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Evento
                </label>
                <input
                  type="text"
                  value={formData.nombreEvento}
                  onChange={(e) => handleInputChange('nombreEvento', e.target.value)}
                  className="input w-full"
                  placeholder="Nombre específico del evento"
                />
              </div>
            )}

            {/* Advisor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advisor *
              </label>
              <select
                value={formData.advisor}
                onChange={(e) => handleInputChange('advisor', e.target.value)}
                className="input w-full"
                required
              >
                <option value="">Seleccionar advisor</option>
                {advisors
                  .slice()
                  .sort((a, b) => {
                    const nameA = `${a.primerNombre} ${a.primerApellido}`.toLowerCase()
                    const nameB = `${b.primerNombre} ${b.primerApellido}`.toLowerCase()
                    return nameA.localeCompare(nameB)
                  })
                  .map((advisor) => (
                    <option key={advisor._id} value={advisor._id}>
                      {advisor.primerNombre} {advisor.primerApellido}
                    </option>
                  ))}
              </select>
            </div>

            {/* Límite de Usuarios */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Límite de Usuarios *
              </label>
              <input
                type="number"
                value={formData.limiteUsuarios}
                onChange={(e) => handleInputChange('limiteUsuarios', Number(e.target.value))}
                className="input w-full"
                min="1"
                max="100"
                required
              />
            </div>

            {/* Link Zoom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link de Zoom
              </label>
              <input
                type="url"
                value={formData.linkZoom}
                onChange={(e) => handleInputChange('linkZoom', e.target.value)}
                className="input w-full"
                placeholder="https://zoom.us/..."
              />
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => handleInputChange('observaciones', e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Notas adicionales sobre el evento"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {editingEvent ? 'Actualizando...' : 'Creando...'}
                  </div>
                ) : (
                  editingEvent ? 'Actualizar Evento' : 'Crear Evento'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}