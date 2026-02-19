'use client'

import { useState, useEffect } from 'react'
import { Person, Beneficiary } from '@/types'
import { formatDate } from '@/lib/utils'
import { UserPlusIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { PermissionGuard } from '@/components/permissions'
import { PersonPermission } from '@/types/permissions'

interface PersonAdminProps {
  person: Person
  beneficiaries: Beneficiary[]
}

// Plataformas activas (solo para dropdown Plataforma)
const PREFIJOS_PAISES = [
  { pais: "Chile", prefijo: "+56" },
  { pais: "Colombia", prefijo: "+57" },
  { pais: "Ecuador", prefijo: "+593" },
  { pais: "Perú", prefijo: "+51" },
]

// Indicativos telefónicos disponibles (para selector de celular)
const PREFIJOS_CELULAR = [
  { pais: "Australia", codigo: "AU", prefijo: "+61" },
  { pais: "Chile", codigo: "CL", prefijo: "+56" },
  { pais: "Colombia", codigo: "CO", prefijo: "+57" },
  { pais: "Ecuador", codigo: "EC", prefijo: "+593" },
  { pais: "Estados Unidos", codigo: "US", prefijo: "+1" },
  { pais: "Perú", codigo: "PE", prefijo: "+51" },
]

export default function PersonAdmin({ person, beneficiaries }: PersonAdminProps) {
  console.log('🧪 PersonAdmin render - Props:', {
    personId: person._id,
    beneficiariesCount: beneficiaries?.length || 0,
    beneficiaries
  })
  const [selectedEstado, setSelectedEstado] = useState(person.aprobacion || 'Pendiente')
  const [newComment, setNewComment] = useState('')
  const [showBeneficiaryForm, setShowBeneficiaryForm] = useState(false)
  const [newBeneficiaryId, setNewBeneficiaryId] = useState<string | null>(null)
  const [currentFormStep, setCurrentFormStep] = useState(1)
  const [beneficiaryData, setBeneficiaryData] = useState({
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    numeroId: '',
    fechaNacimiento: '',
    pais: '',
    domicilio: '',
    ciudad: '',
    celularPrefijo: '+57',
    celular: '',
    email: '',
    genero: ''
  })
  const [currentBeneficiaries, setCurrentBeneficiaries] = useState<Beneficiary[]>(beneficiaries)
  const [approvingBeneficiaries, setApprovingBeneficiaries] = useState<Set<string>>(new Set())
  const [processStatus, setProcessStatus] = useState<Record<string, string>>({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<Beneficiary | null>(null)
  const [isDeletingBeneficiary, setIsDeletingBeneficiary] = useState(false)
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [pendingEstado, setPendingEstado] = useState<string | null>(null)
  const [originalEstado, setOriginalEstado] = useState<string>(person.aprobacion || 'Pendiente')
  const [isUpdatingEstado, setIsUpdatingEstado] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingBeneficiaryId, setEditingBeneficiaryId] = useState<string | null>(null)
  const [isTogglingContract, setIsTogglingContract] = useState(false)

  // Sincronizar las props con el estado local
  useEffect(() => {
    console.log('🔄 PersonAdmin: Beneficiaries props changed:', beneficiaries)
    setCurrentBeneficiaries(beneficiaries)
  }, [beneficiaries])

  // Mock comments
  const comments = [
    {
      _id: '1',
      tipo: 'Seguimiento',
      prioridad: 'Media',
      comentario: 'Cliente solicita información sobre horarios disponibles para beneficiario adicional.',
      autor: 'Ana García',
      fechaCreacion: '2024-08-15T10:30:00Z'
    },
    {
      _id: '2',
      tipo: 'Información',
      prioridad: 'Baja',
      comentario: 'Documentación completa recibida y verificada.',
      autor: 'Carlos López',
      fechaCreacion: '2024-08-10T14:15:00Z'
    }
  ]

  const estadoOptions = [
    'Aprobado',
    'Contrato nulo',
    'Devuelto',
    'Pendiente',
    'Rechazado'
  ]

  const handleApproveSpecificBeneficiary = async (beneficiaryId: string) => {
    if (!beneficiaryId) return

    setApprovingBeneficiaries(prev => new Set(prev).add(beneficiaryId))
    setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Aprobando...' }))

    try {
      const response = await fetch(`/api/postgres/people/${beneficiaryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprobacion: 'Aprobado' })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCurrentBeneficiaries(prev =>
          prev.map(ben =>
            ben._id === beneficiaryId ? { ...ben, estado: 'Aprobado' } : ben
          )
        )

        // Enviar WhatsApp de bienvenida si el beneficiario tiene celular
        const beneficiary = currentBeneficiaries.find(b => b._id === beneficiaryId)
        if (beneficiary?.celular) {
          setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Enviando WhatsApp...' }))
          try {
            const whatsappResponse = await fetch('/api/wix/sendWelcomeWhatsApp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                celular: beneficiary.celular,
                beneficiarioId: beneficiaryId,
                nombre: beneficiary.nombre,
              })
            })
            const whatsappResult = await whatsappResponse.json()
            if (whatsappResponse.ok && whatsappResult.success) {
              setCurrentBeneficiaries(prev =>
                prev.map(ben => ben._id === beneficiaryId ? { ...ben, whatsappSent: true } : ben)
              )
              setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Completado ✅' }))
            } else {
              console.error('❌ Error enviando WhatsApp:', whatsappResult)
              setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Aprobado (sin WhatsApp)' }))
            }
          } catch (whatsappError) {
            console.error('❌ Error enviando WhatsApp:', whatsappError)
            setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Aprobado (sin WhatsApp)' }))
          }
        } else {
          setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Completado ✅' }))
        }

        setTimeout(() => {
          setProcessStatus(prev => { const s = { ...prev }; delete s[beneficiaryId]; return s })
          setApprovingBeneficiaries(prev => { const s = new Set(prev); s.delete(beneficiaryId); return s })
        }, 2000)
      } else {
        setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Error ❌' }))
        setTimeout(() => {
          setProcessStatus(prev => { const s = { ...prev }; delete s[beneficiaryId]; return s })
          setApprovingBeneficiaries(prev => { const s = new Set(prev); s.delete(beneficiaryId); return s })
        }, 3000)
      }
    } catch (error) {
      console.error('❌ Error aprobando beneficiario:', error)
      setProcessStatus(prev => ({ ...prev, [beneficiaryId]: 'Error ❌' }))
      setTimeout(() => {
        setProcessStatus(prev => { const s = { ...prev }; delete s[beneficiaryId]; return s })
        setApprovingBeneficiaries(prev => { const s = new Set(prev); s.delete(beneficiaryId); return s })
      }, 3000)
    }
  }

  const handleEstadoChange = (newEstado: string) => {
    console.log('=== handleEstadoChange INICIADO ===')
    console.log('Nuevo estado solicitado:', newEstado)
    console.log('Estado actual:', selectedEstado)

    // Guardar el estado pendiente y mostrar modal de confirmación
    setPendingEstado(newEstado)
    setShowEstadoModal(true)

    console.log('Modal de confirmación mostrado para cambio de estado')
  }

  const handleAddComment = () => {
    if (newComment.trim()) {
      console.log('Adding comment:', newComment)
      // API call would go here
      setNewComment('')
    }
  }

  const handleDeleteBeneficiary = (beneficiary: Beneficiary) => {
    setBeneficiaryToDelete(beneficiary)
    setShowDeleteModal(true)
  }

  const handleInactivateBeneficiary = async (beneficiary: Beneficiary) => {
    try {
      const response = await fetch(`/api/postgres/people/${beneficiary._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoInactivo: true })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCurrentBeneficiaries(prev =>
          prev.map(b =>
            b._id === beneficiary._id
              ? { ...b, estado: 'Inactivo' as any, estadoInactivo: true }
              : b
          )
        )
      } else {
        console.error('❌ Error inactivando beneficiario:', data.error)
      }
    } catch (error) {
      console.error('❌ Error inactivando beneficiario:', error)
    }
  }

  const confirmDeleteBeneficiary = async () => {
    if (!beneficiaryToDelete) return

    setIsDeletingBeneficiary(true)

    try {
      const response = await fetch(`/api/postgres/people/${beneficiaryToDelete._id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCurrentBeneficiaries(prev =>
          prev.filter(b => b._id !== beneficiaryToDelete._id)
        )
        setShowDeleteModal(false)
        setBeneficiaryToDelete(null)
      } else {
        console.error('❌ Error al eliminar beneficiario:', data.error)
      }
    } catch (error) {
      console.error('❌ Error eliminando beneficiario:', error)
    } finally {
      setIsDeletingBeneficiary(false)
    }
  }

  const cancelDeleteBeneficiary = () => {
    setShowDeleteModal(false)
    setBeneficiaryToDelete(null)
  }

  const confirmEstadoChange = async () => {
    if (!pendingEstado) return

    console.log('=== CONFIRMACIÓN DE CAMBIO DE ESTADO INICIADA ===')
    console.log('Estado a aplicar:', pendingEstado)

    setIsUpdatingEstado(true)

    try {
      const response = await fetch(`/api/postgres/people/${person._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprobacion: pendingEstado })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSelectedEstado(pendingEstado as any)
        setOriginalEstado(pendingEstado as any)
        setShowEstadoModal(false)
        setPendingEstado(null)
      } else {
        console.error('❌ Error al actualizar estado:', data.error)
        setSelectedEstado(originalEstado as any)
      }
    } catch (error) {
      console.error('❌ Error actualizando estado:', error)
      setSelectedEstado(originalEstado as any)
    } finally {
      setIsUpdatingEstado(false)
    }
  }

  const cancelEstadoChange = () => {
    console.log('=== CANCELANDO CAMBIO DE ESTADO ===')

    // Restaurar estado original
    setSelectedEstado(originalEstado as any)

    // Cerrar modal
    setShowEstadoModal(false)
    setPendingEstado(null)

    console.log('✓ Cambio de estado cancelado')
  }

  const handleToggleContractStatus = async () => {
    const currentStatus = !person.estadoInactivo // true = activo, false = inactivo
    const newStatus = !currentStatus
    const setInactive = !newStatus // Si queremos activar (newStatus=true), setInactive debe ser false

    const affectedUsers = [
      `Titular: ${person.primerNombre} ${person.primerApellido} (${person.numeroId})`,
      ...currentBeneficiaries.map(b => `Beneficiario: ${b.nombre} ${b.apellido} (${b.numeroId})`)
    ]

    const confirmed = window.confirm(
      `⚠️ ATENCIÓN: Esta acción afectará a TODO el contrato ${person.contrato}\n\n` +
      `¿Está seguro que desea ${newStatus ? 'ACTIVAR' : 'INACTIVAR'} el contrato completo?\n\n` +
      `Usuarios afectados (${affectedUsers.length}):\n` +
      affectedUsers.map(u => `  • ${u}`).join('\n') + '\n\n' +
      `Esta acción:\n` +
      `  • Marcará estadoInactivo como ${setInactive ? 'true' : 'false'}\n` +
      `  • Se aplicará en PEOPLE y ACADEMICA\n` +
      `  • Afectará a ${affectedUsers.length} usuario(s)\n`
    )

    if (!confirmed) return

    setIsTogglingContract(true)

    try {
      const response = await fetch('/api/postgres/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contrato: person.contrato,
          titularId: person._id,
          beneficiaryIds: currentBeneficiaries.map(b => b._id),
          setInactive
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ Contrato ${newStatus ? 'activado' : 'inactivado'} exitosamente\n\n` +
              `Usuarios actualizados: ${data.updatedCount || affectedUsers.length}`)
        // Hard reload to bypass Next.js cache
        window.location.href = window.location.href
      } else {
        alert(`❌ Error al cambiar estado del contrato: ${data.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error al cambiar estado del contrato:', error)
      alert('❌ Error al comunicarse con el servidor')
    } finally {
      setIsTogglingContract(false)
    }
  }

  const handleEditBeneficiary = async (beneficiaryId: string) => {
    setIsEditMode(true)
    setEditingBeneficiaryId(beneficiaryId)

    try {
      const response = await fetch(`/api/postgres/people/${beneficiaryId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.person) {
          const ben = result.person

          setBeneficiaryData({
            primerNombre: ben.primerNombre || '',
            segundoNombre: ben.segundoNombre || '',
            primerApellido: ben.primerApellido || '',
            segundoApellido: ben.segundoApellido || '',
            numeroId: ben.numeroId || '',
            fechaNacimiento: ben.fechaNacimiento || '',
            edad: ben.edad || '',
            pais: ben.pais || ben.plataforma || '',
            domicilio: ben.domicilio || '',
            ciudad: ben.ciudad || '',
            celular: ben.celular || '',
            email: ben.email || '',
            genero: ben.genero || ''
          })

          setNewBeneficiaryId(beneficiaryId)
          setShowBeneficiaryForm(true)
          setCurrentFormStep(1)
        }
      }
    } catch (error) {
      console.error('Error loading beneficiary:', error)
    }
  }

  const handleAddBeneficiary = () => {
    setIsEditMode(false)
    setEditingBeneficiaryId(null)
    setBeneficiaryData({
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      numeroId: '',
      fechaNacimiento: '',
      edad: '',
      pais: '',
      domicilio: '',
      ciudad: '',
      celularPrefijo: '+57',
      celular: '',
      email: '',
      genero: ''
    })
    setNewBeneficiaryId('__new__')
    setShowBeneficiaryForm(true)
    setCurrentFormStep(1)
  }

  const handleBeneficiaryDataChange = (field: string, value: string) => {
    setBeneficiaryData(prev => ({ ...prev, [field]: value }))
  }

  const validateRequiredFields = (step: number): boolean => {
    if (step === 1) {
      return (
        beneficiaryData.primerNombre.trim() !== '' &&
        beneficiaryData.primerApellido.trim() !== '' &&
        beneficiaryData.numeroId.trim() !== '' &&
        beneficiaryData.pais !== ''
      )
    } else if (step === 2) {
      return (
        beneficiaryData.fechaNacimiento !== '' &&
        beneficiaryData.genero !== '' &&
        beneficiaryData.ciudad !== '' &&
        beneficiaryData.domicilio.trim() !== '' &&
        beneficiaryData.celular.trim() !== '' &&
        beneficiaryData.email.trim() !== ''
      )
    }
    return true
  }

  const handleFormNext = () => {
    // Validar campos obligatorios antes de avanzar
    if (validateRequiredFields(currentFormStep)) {
      if (currentFormStep < 2) {
        setCurrentFormStep(currentFormStep + 1)
      }
    } else {
      alert('Por favor complete todos los campos obligatorios marcados con *')
    }
  }

  const handleFormPrev = () => {
    if (currentFormStep > 1) {
      setCurrentFormStep(currentFormStep - 1)
    }
  }

  const handleSaveBeneficiary = async () => {
    // Normalizar celular: remover '+', espacios y caracteres no numéricos → ej: "+57 3008021701" → "573008021701"
    // Concatenar prefijo + número y eliminar todo excepto dígitos → ej: "+57" + "3008021701" = "573008021701"
    const normalizedCelular = ((beneficiaryData.celularPrefijo || '') + (beneficiaryData.celular || '')).replace(/\D/g, '')

    try {
      let response: Response

      if (isEditMode && editingBeneficiaryId) {
        // PATCH - only contact fields are editable
        response = await fetch(`/api/postgres/people/${editingBeneficiaryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            celular: normalizedCelular || undefined,
            domicilio: beneficiaryData.domicilio,
            email: beneficiaryData.email,
          })
        })
      } else {
        // POST - create new beneficiary in PEOPLE
        response = await fetch('/api/postgres/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primerNombre: beneficiaryData.primerNombre,
            segundoNombre: beneficiaryData.segundoNombre || undefined,
            primerApellido: beneficiaryData.primerApellido,
            segundoApellido: beneficiaryData.segundoApellido || undefined,
            numeroId: beneficiaryData.numeroId,
            tipoUsuario: 'BENEFICIARIO',
            contrato: person.contrato || '',
            aprobacion: 'Pendiente',
            email: beneficiaryData.email || undefined,
            celular: normalizedCelular || undefined,
            fechaNacimiento: beneficiaryData.fechaNacimiento || undefined,
            ciudad: beneficiaryData.ciudad || undefined,
            domicilio: beneficiaryData.domicilio || undefined,
            // Campos del form
            plataforma: beneficiaryData.pais || undefined,
            // Campos heredados del titular
            finalContrato: person.finalContrato || undefined,
            vigencia: person.vigencia || undefined,
            fechaIngreso: new Date().toISOString(),
          })
        })
      }

      const result = await response.json()

      if (response.ok && result.success) {
        if (isEditMode && editingBeneficiaryId) {
          setCurrentBeneficiaries(prev =>
            prev.map(ben =>
              ben._id === editingBeneficiaryId
                ? { ...ben, celular: normalizedCelular || beneficiaryData.celular }
                : ben
            )
          )
        } else {
          // Add newly created beneficiary to the list
          const created = result.person
          const newBen: Beneficiary = {
            _id: created._id,
            numeroId: created.numeroId,
            nombre: created.primerNombre,
            apellido: [created.primerApellido, created.segundoApellido].filter(Boolean).join(' '),
            celular: (created.celular || '').replace(/\D/g, '') || created.celular || '',
            estado: 'Pendiente',
            fechaCreacion: created._createdDate || new Date().toISOString(),
          }
          setCurrentBeneficiaries(prev => [...prev, newBen])
        }

        setShowBeneficiaryForm(false)
        setNewBeneficiaryId(null)
        setIsEditMode(false)
        setEditingBeneficiaryId(null)
        setBeneficiaryData({
          primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '',
          numeroId: '', fechaNacimiento: '', edad: '', pais: '', domicilio: '',
          ciudad: '', celular: '', email: '', genero: ''
        })
        setCurrentFormStep(1)
      } else {
        console.error('❌ Error guardando beneficiario:', result.error, result.details)
        alert(`Error: ${result.error || 'No se pudo guardar el beneficiario'}\n${result.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error guardando beneficiario:', error)
    }
  }

  const getEstadoBadgeClass = (estado: string): string => {
    switch (estado) {
      case 'Aprobado':
        return 'badge-success'
      case 'Pendiente':
        return 'badge-warning'
      case 'Rechazado':
        return 'badge-danger'
      case 'ON HOLD':
        return 'badge-warning'
      case 'Eliminado':
        return 'badge-danger'
      case 'Inactivo':
        return 'badge-secondary'
      default:
        return 'badge-info'
    }
  }

  const getPrioridadBadgeClass = (prioridad: string): string => {
    switch (prioridad) {
      case 'Crítica':
        return 'badge-danger'
      case 'Alta':
        return 'badge-warning'
      case 'Media':
        return 'badge-info'
      case 'Baja':
        return 'badge-success'
      default:
        return 'badge-info'
    }
  }

  console.log('🔍 currentBeneficiaries antes del render:', currentBeneficiaries)

  return (
    <div className="space-y-8">
      {/* Acciones (Contract-wide Actions) */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">⚙️ Acciones</h3>
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="text-base font-semibold text-gray-900">Estado del Contrato</h4>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  !person.estadoInactivo
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                }`}>
                  {!person.estadoInactivo ? '✅ ACTIVO' : '⚠️ INACTIVO'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                Inactivar el contrato {person.contrato} afectará:
              </p>
              <ul className="text-xs text-gray-500 space-y-1 ml-4">
                <li>• Titular: {person.primerNombre} {person.primerApellido}</li>
                <li>• {currentBeneficiaries.length} beneficiario(s) asociado(s)</li>
                <li>• Actualización en bases de datos PEOPLE y ACADEMICA</li>
              </ul>
            </div>
            <PermissionGuard permission={PersonPermission.ACTIVAR_DESACTIVAR}>
              <div className="flex items-center gap-4 ml-6">
                <span className={`text-sm font-semibold ${!person.estadoInactivo ? 'text-green-600' : 'text-gray-400'}`}>
                  Activo
                </span>
                <button
                  onClick={handleToggleContractStatus}
                  disabled={isTogglingContract}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isTogglingContract
                      ? 'bg-gray-300 cursor-not-allowed'
                      : !person.estadoInactivo
                        ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                        : 'bg-gray-300 hover:bg-gray-400 focus:ring-gray-400'
                  }`}
                  title={!person.estadoInactivo ? 'Inactivar contrato completo' : 'Activar contrato completo'}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 shadow-md ${
                      !person.estadoInactivo ? 'translate-x-9' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm font-semibold ${person.estadoInactivo ? 'text-yellow-600' : 'text-gray-400'}`}>
                  Inactivo
                </span>
              </div>
            </PermissionGuard>
          </div>
        </div>

      </div>

      {/* Titular Status */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Estado del Titular</h3>
        <PermissionGuard permission={PersonPermission.CAMBIAR_ESTADO}>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado Actual
                </label>
                <select
                  value={selectedEstado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  className="input-field"
                >
                  {estadoOptions.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado === 'Aprobado' && '✅ '}
                      {estado === 'Contrato nulo' && '⚪ '}
                      {estado === 'Devuelto' && '🔄 '}
                      {estado === 'Pendiente' && '⏳ '}
                      {estado === 'Rechazado' && '❌ '}
                      {estado}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <div>
                  <span className="text-sm font-medium text-gray-700">Estado Visible:</span>
                  <div className="mt-1">
                    <span className={`badge ${getEstadoBadgeClass(selectedEstado)}`}>
                      {selectedEstado}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PermissionGuard>
      </div>

      {/* Beneficiaries Management */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Gestión de Beneficiarios</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="space-y-4">
          {currentBeneficiaries.map((beneficiary) => {
            const whatsappSent = (beneficiary as any).whatsappSent
            console.log(`🔄 Renderizando ${beneficiary.nombre}: estado=${beneficiary.estado}, whatsappSent=${whatsappSent}, celular=${beneficiary.celular}`)
            return (
            <div key={beneficiary._id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">
                      {beneficiary.nombre} {beneficiary.apellido}
                    </h4>
                    <span className={`badge ${getEstadoBadgeClass(beneficiary.estado)}`}>
                      {beneficiary.estado}
                    </span>
                    {beneficiary.estado === 'Aprobado' && whatsappSent && (
                      <div className="flex items-center space-x-1 text-green-600 bg-green-100 px-2 py-1 rounded" title="WhatsApp enviado">
                        <span className="text-sm">📱✅ WhatsApp Enviado</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    ID: {beneficiary.numeroId} • Creado: {formatDate(beneficiary.fechaCreacion)}
                    {beneficiary.celular && ` • Tel: ${beneficiary.celular}`}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <PermissionGuard permission={PersonPermission.MODIFICAR}>
                    <button
                      onClick={() => handleEditBeneficiary(beneficiary._id)}
                      className="inline-flex items-center px-4 py-1.5 border border-blue-600 text-sm font-medium rounded text-blue-600 bg-white hover:bg-blue-600 hover:text-white transition-colors"
                      title="Modificar beneficiario"
                    >
                      Modificar
                    </button>
                  </PermissionGuard>
                  {(beneficiary.estado === 'Pendiente' || approvingBeneficiaries.has(beneficiary._id)) && (
                    <PermissionGuard permission={PersonPermission.APROBAR}>
                      <button
                        onClick={() => handleApproveSpecificBeneficiary(beneficiary._id)}
                        disabled={approvingBeneficiaries.has(beneficiary._id)}
                        className="inline-flex items-center px-4 py-1.5 border border-black text-sm font-medium rounded text-black bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {approvingBeneficiaries.has(beneficiary._id) ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-1.5"></div>
                            {processStatus[beneficiary._id] || 'Procesando...'}
                          </>
                        ) : (
                          'Aprobar'
                        )}
                      </button>
                    </PermissionGuard>
                  )}
                  {beneficiary.estado === 'Aprobado' ? (
                    <PermissionGuard permission={PersonPermission.ACTIVAR_DESACTIVAR}>
                      <button
                        onClick={() => handleInactivateBeneficiary(beneficiary)}
                        className="inline-flex items-center px-4 py-1.5 border border-orange-600 text-sm font-medium rounded text-orange-600 bg-white hover:bg-orange-600 hover:text-white transition-colors"
                        title="Inactivar beneficiario"
                      >
                        Inactivar
                      </button>
                    </PermissionGuard>
                  ) : beneficiary.estado === 'Inactivo' ? (
                    <div className="inline-flex items-center px-4 py-1.5 border border-gray-400 text-sm font-medium rounded text-gray-500 bg-gray-50 cursor-not-allowed">
                      Inactivo
                    </div>
                  ) : (
                    <PermissionGuard permission={PersonPermission.ELIMINAR}>
                      <button
                        onClick={() => handleDeleteBeneficiary(beneficiary)}
                        className="inline-flex items-center px-4 py-1.5 border border-red-600 text-sm font-medium rounded text-red-600 bg-white hover:bg-red-600 hover:text-white transition-colors"
                        title="Eliminar beneficiario"
                      >
                        Eliminar
                      </button>
                    </PermissionGuard>
                  )}
                </div>
              </div>
            </div>
            )
          })}

          {/* Add Beneficiary Button - Now at the bottom */}
          <PermissionGuard permission={PersonPermission.AGREGAR_BENEFICIARIO}>
            <div className="pt-4 flex justify-end">
              <button
                onClick={handleAddBeneficiary}
                className="btn-primary flex items-center space-x-2"
              >
                <UserPlusIcon className="h-4 w-4" />
                <span>Agregar Beneficiario</span>
              </button>
            </div>
          </PermissionGuard>
          </div>
        </div>
      </div>

      {/* WhatsApp Administrative */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">📱 WhatsApp Administrativo</h3>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-green-800 mb-3">Mensajería Masiva</h4>
              <div className="space-y-2">
                <button className="w-full text-left p-3 bg-white border border-green-200 rounded hover:bg-green-50">
                  <div className="font-medium text-green-900">Recordatorio de Pago</div>
                  <div className="text-sm text-green-700">Enviar recordatorio de cuota mensual</div>
                </button>
                <button className="w-full text-left p-3 bg-white border border-green-200 rounded hover:bg-green-50">
                  <div className="font-medium text-green-900">Actualización de Contrato</div>
                  <div className="text-sm text-green-700">Notificar cambios en el contrato</div>
                </button>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-green-800 mb-3">Automatizaciones</h4>
              <div className="space-y-2">
                <button className="w-full text-left p-3 bg-white border border-green-200 rounded hover:bg-green-50">
                  <div className="font-medium text-green-900">Bienvenida Nuevo Beneficiario</div>
                  <div className="text-sm text-green-700">Mensaje automático para nuevos estudiantes</div>
                </button>
                <button className="w-full text-left p-3 bg-white border border-green-200 rounded hover:bg-green-50">
                  <div className="font-medium text-green-900">Seguimiento Progreso</div>
                  <div className="text-sm text-green-700">Actualizaciones de progreso académico</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Beneficiary Form Modal */}
      {showBeneficiaryForm && newBeneficiaryId && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {isEditMode
                  ? `Modificar Beneficiario`
                  : `Crear Nuevo Beneficiario para ${person.primerNombre} ${person.primerApellido}`
                }
              </h3>
              <button
                onClick={() => {
                  setShowBeneficiaryForm(false)
                  setNewBeneficiaryId(null)
                  setCurrentFormStep(1)
                  setIsEditMode(false)
                  setEditingBeneficiaryId(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Edit Mode: Only 3 fields */}
            {isEditMode ? (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 mb-4">Información de Contacto</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Celular *
                    </label>
                    <input
                      type="tel"
                      value={beneficiaryData.celular}
                      onChange={(e) => handleBeneficiaryDataChange('celular', e.target.value)}
                      className="input-field"
                      placeholder="Número de celular"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domicilio *
                    </label>
                    <input
                      type="text"
                      value={beneficiaryData.domicilio}
                      onChange={(e) => handleBeneficiaryDataChange('domicilio', e.target.value)}
                      className="input-field"
                      placeholder="Dirección de domicilio"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={beneficiaryData.email}
                      onChange={(e) => handleBeneficiaryDataChange('email', e.target.value)}
                      className="input-field"
                      placeholder="Correo electrónico"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Basic Information */}
                {currentFormStep === 1 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 mb-4">Información Básica</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Primer Nombre *
                        </label>
                        <input
                          type="text"
                          value={beneficiaryData.primerNombre}
                          onChange={(e) => handleBeneficiaryDataChange('primerNombre', e.target.value)}
                          className="input-field"
                          placeholder="Primer nombre"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Segundo Nombre
                        </label>
                        <input
                          type="text"
                          value={beneficiaryData.segundoNombre}
                          onChange={(e) => handleBeneficiaryDataChange('segundoNombre', e.target.value)}
                          className="input-field"
                          placeholder="Segundo nombre"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Primer Apellido *
                        </label>
                        <input
                          type="text"
                          value={beneficiaryData.primerApellido}
                          onChange={(e) => handleBeneficiaryDataChange('primerApellido', e.target.value)}
                          className="input-field"
                          placeholder="Primer apellido"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Segundo Apellido
                        </label>
                        <input
                          type="text"
                          value={beneficiaryData.segundoApellido}
                          onChange={(e) => handleBeneficiaryDataChange('segundoApellido', e.target.value)}
                          className="input-field"
                          placeholder="Segundo apellido"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Número de Identificación *
                        </label>
                        <input
                          type="text"
                          value={beneficiaryData.numeroId}
                          onChange={(e) => handleBeneficiaryDataChange('numeroId', e.target.value)}
                          className="input-field"
                          placeholder="Número de ID"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Plataforma *
                        </label>
                        <select
                          value={beneficiaryData.pais}
                          onChange={(e) => handleBeneficiaryDataChange('pais', e.target.value)}
                          className="input-field"
                        >
                          <option value="">Seleccionar</option>
                          {PREFIJOS_PAISES.map(item => (
                            <option key={item.pais} value={item.pais}>
                              {item.pais}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Contact and Personal Information */}
                {currentFormStep === 2 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 mb-4">Información Personal y Contacto</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fecha de Nacimiento *
                        </label>
                        <input
                          type="date"
                          value={beneficiaryData.fechaNacimiento}
                          onChange={(e) => handleBeneficiaryDataChange('fechaNacimiento', e.target.value)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Género *
                        </label>
                        <select
                          value={beneficiaryData.genero}
                          onChange={(e) => handleBeneficiaryDataChange('genero', e.target.value)}
                          className="input-field"
                        >
                          <option value="">Seleccionar</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ciudad *
                        </label>
                        <input
                          type="text"
                          value={beneficiaryData.ciudad}
                          onChange={(e) => handleBeneficiaryDataChange('ciudad', e.target.value)}
                          className="input-field"
                          placeholder="Ciudad"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Domicilio *
                        </label>
                        <input
                          type="text"
                          value={beneficiaryData.domicilio}
                          onChange={(e) => handleBeneficiaryDataChange('domicilio', e.target.value)}
                          className="input-field"
                          placeholder="Dirección de domicilio"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Celular *
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={beneficiaryData.celularPrefijo}
                            onChange={(e) => handleBeneficiaryDataChange('celularPrefijo', e.target.value)}
                            className="input-field w-28 flex-shrink-0"
                          >
                            {PREFIJOS_CELULAR.map(item => (
                              <option key={item.codigo} value={item.prefijo}>
                                {item.prefijo} ({item.codigo})
                              </option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            value={beneficiaryData.celular}
                            onChange={(e) => handleBeneficiaryDataChange('celular', e.target.value)}
                            className="input-field flex-1"
                            placeholder="Número de celular"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={beneficiaryData.email}
                          onChange={(e) => handleBeneficiaryDataChange('email', e.target.value)}
                          className="input-field"
                          placeholder="Correo electrónico"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Form Navigation */}
            {isEditMode ? (
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSaveBeneficiary}
                  disabled={!beneficiaryData.celular || !beneficiaryData.domicilio || !beneficiaryData.email}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Guardar Cambios
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    {currentFormStep > 1 && (
                      <button
                        onClick={handleFormPrev}
                        className="btn-secondary"
                      >
                        Anterior
                      </button>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    {currentFormStep < 2 ? (
                      <button
                        onClick={handleFormNext}
                        className="btn-primary"
                      >
                        Siguiente
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveBeneficiary}
                        disabled={!validateRequiredFields(2)}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Crear Beneficiario
                      </button>
                    )}
                  </div>
                </div>

                {/* Step indicator */}
                <div className="mt-4 flex justify-center">
                  <div className="flex space-x-2">
                    {[1, 2].map((step) => (
                      <div
                        key={step}
                        className={`w-3 h-3 rounded-full ${
                          step === currentFormStep ? 'bg-primary-600' :
                          step < currentFormStep ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && beneficiaryToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Eliminar Beneficiario
              </h3>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">
                ¿Estás seguro de que quieres eliminar a{' '}
                <span className="font-medium text-gray-900">
                  {beneficiaryToDelete.nombre} {beneficiaryToDelete.apellido}
                </span>
                ?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Esta acción eliminará el beneficiario tanto de la plataforma como de Académica y no se puede deshacer.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={cancelDeleteBeneficiary}
                disabled={isDeletingBeneficiary}
                className="flex-1 bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteBeneficiary}
                disabled={isDeletingBeneficiary}
                className="flex-1 bg-red-600 border border-transparent rounded-md px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDeletingBeneficiary ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Eliminando...
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado Change Confirmation Modal */}
      {showEstadoModal && pendingEstado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">!</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Confirmar Cambio de Estado
                </h3>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">
                ¿Estás seguro de que quieres cambiar el estado de{' '}
                <span className="font-medium text-gray-900">
                  {person.primerNombre} {person.primerApellido}
                </span>{' '}
                a{' '}
                <span className="font-medium text-gray-900">
                  {pendingEstado}
                </span>
                ?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Este cambio se aplicará en la base de datos y será visible inmediatamente.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={cancelEstadoChange}
                disabled={isUpdatingEstado}
                className="flex-1 bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmEstadoChange}
                disabled={isUpdatingEstado}
                className="flex-1 bg-blue-600 border border-transparent rounded-md px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isUpdatingEstado ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Actualizando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}