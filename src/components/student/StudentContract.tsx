'use client'

import { useState } from 'react'
import { Student } from '@/types'
import { formatDate } from '@/lib/utils'
import StudentOnHold from './StudentOnHold'
import { api, ApiError } from '@/hooks/use-api'

interface StudentContractProps {
  student: Student
  contratoFinalizado?: boolean
}

export default function StudentContract({ student, contratoFinalizado = false }: StudentContractProps) {
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [nuevaFechaFinal, setNuevaFechaFinal] = useState('')
  const [motivoExtension, setMotivoExtension] = useState('')
  const [isExtendingVigencia, setIsExtendingVigencia] = useState(false)
  const [showExtensionHistory, setShowExtensionHistory] = useState(false)

  // Mock contract holder data - in real implementation, this would come from API
  const contractHolder = {
    primerNombre: 'Juan Carlos',
    primerApellido: 'Rodríguez',
    numeroId: '12345678',
    celular: '+57 300 123 4567',
    email: 'juan.rodriguez@email.com',
    domicilio: 'Calle 123 #45-67',
    ciudad: 'Bogotá',
    asesor: 'Maria García',
    contrato: student.contrato,
    vigencia: '2024-12-31',
    fechaCreacion: '2024-01-15'
  }

  const contractGroups = [
    {
      title: 'Información del Asesor',
      color: 'bg-blue-50 border-blue-200',
      fields: [
        { label: 'Asesor Asignado', value: contractHolder.asesor }
      ]
    },
    {
      title: 'Datos Personales Básicos',
      color: 'bg-green-50 border-green-200',
      fields: [
        { label: 'Primer Nombre', value: contractHolder.primerNombre },
        { label: 'Primer Apellido', value: contractHolder.primerApellido },
        { label: 'Número de Documento', value: contractHolder.numeroId }
      ]
    },
    {
      title: 'Contacto y Ubicación',
      color: 'bg-purple-50 border-purple-200',
      fields: [
        { label: 'Celular', value: contractHolder.celular },
        { label: 'Email', value: contractHolder.email },
        { label: 'Domicilio', value: contractHolder.domicilio },
        { label: 'Ciudad', value: contractHolder.ciudad }
      ]
    },
    {
      title: 'Datos Adicionales',
      color: 'bg-orange-50 border-orange-200',
      fields: [
        { label: 'Tipo de Usuario', value: 'TITULAR' },
        { label: 'Estado', value: 'Aprobado' }
      ]
    },
    {
      title: 'Referencias',
      color: 'bg-pink-50 border-pink-200',
      fields: [
        { label: 'Referencia Personal', value: 'Ana López - 300 987 6543' },
        { label: 'Referencia Comercial', value: 'Empresa XYZ - 601 234 5678' }
      ]
    },
    {
      title: 'Información Financiera Completa',
      color: 'bg-yellow-50 border-yellow-200',
      fields: [
        { label: 'Número de Contrato', value: contractHolder.contrato },
        { label: 'Vigencia del Contrato', value: formatDate(contractHolder.vigencia) },
        { label: 'Fecha de Creación', value: formatDate(contractHolder.fechaCreacion) },
        { label: 'Tarifa Mensual', value: '$350.000 COP' },
        { label: 'Estado de Pago', value: 'Al día' }
      ]
    }
  ]

  const handleExtendVigencia = async () => {
    if (!nuevaFechaFinal) {
      alert('⚠️ Por favor seleccione una nueva fecha de vigencia')
      return
    }

    const fechaActual = student.finalContrato ? new Date(student.finalContrato) : new Date()
    const nuevaFecha = new Date(nuevaFechaFinal)

    if (nuevaFecha <= fechaActual) {
      alert('⚠️ La nueva fecha debe ser posterior a la fecha actual de vigencia')
      return
    }

    const diasExtendidos = Math.ceil((nuevaFecha.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24))

    const confirmed = window.confirm(
      `⚠️ ATENCIÓN: Extensión de Vigencia para ${student.primerNombre} ${student.primerApellido}\n\n` +
      `¿Está seguro que desea extender la vigencia de este estudiante?\n\n` +
      `Detalles de la extensión:\n` +
      `  • Estudiante: ${student.primerNombre} ${student.primerApellido}\n` +
      `  • Vigencia actual: ${fechaActual.toLocaleDateString('es-ES')}\n` +
      `  • Nueva vigencia: ${nuevaFecha.toLocaleDateString('es-ES')}\n` +
      `  • Días extendidos: ${diasExtendidos} días\n` +
      `  • Motivo: ${motivoExtension || 'Sin motivo especificado'}\n\n` +
      `Esta acción actualizará SOLO la fecha final de este estudiante en PEOPLE.`
    )

    if (!confirmed) return

    setIsExtendingVigencia(true)

    try {
      const studentId = student.peopleId || student._id
      const data = await api.post(`/api/postgres/students/${studentId}/extend`, {
        diasExtension: diasExtendidos,
        motivo: motivoExtension
      })

      alert(
        `✅ Extensión aplicada exitosamente\n\n` +
        `• Estudiante: ${student.primerNombre} ${student.primerApellido}\n` +
        `• Días extendidos: ${data.data?.data?.diasExtendidos || diasExtendidos}\n` +
        `• Nueva vigencia: ${nuevaFecha.toLocaleDateString('es-ES')}\n` +
        `• Extensión #${data.data?.data?.extensionNumero || (student.extensionCount ? student.extensionCount + 1 : 1)}`
      )
      setShowExtensionModal(false)
      setMotivoExtension('')
      window.location.reload()
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Error al comunicarse con el servidor'
      alert(`❌ ${msg}`)
    } finally {
      setIsExtendingVigencia(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Extensión de Vigencia y OnHold - Dos cards lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Extensión de Vigencia del Estudiante */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">📅 Extensión de Vigencia</h3>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Extender Vigencia</h4>
                <p className="text-sm text-gray-600">Cambiar la fecha final solo para este estudiante</p>
              </div>
            </div>
            {student.extensionCount && student.extensionCount > 0 && (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                  📈 {student.extensionCount} {student.extensionCount === 1 ? 'extensión' : 'extensiones'}
                </span>
                <button
                  onClick={() => setShowExtensionHistory(true)}
                  className="text-xs text-green-600 hover:text-green-800 underline font-medium"
                  title="Ver historial de extensiones"
                >
                  Ver historial
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/50 rounded-lg p-3">
                <p className="text-gray-600 font-medium mb-1">📍 Vigencia Actual</p>
                <p className="text-gray-900 font-semibold">
                  {student.finalContrato ? new Date(student.finalContrato).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'No disponible'}
                </p>
              </div>
              <div className="bg-white/50 rounded-lg p-3">
                <p className="text-gray-600 font-medium mb-1">⏱️ Días Restantes</p>
                <p className={`font-semibold ${
                  student.vigencia && typeof student.vigencia === 'number' && student.vigencia < 30 ? 'text-red-600' :
                  student.vigencia && typeof student.vigencia === 'number' && student.vigencia < 90 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {student.vigencia ? `${student.vigencia} días` : 'No disponible'}
                </p>
              </div>
              <div className="bg-white/50 rounded-lg p-3">
                <p className="text-gray-600 font-medium mb-1">📊 Extensiones Realizadas</p>
                <p className="text-gray-900 font-semibold">
                  {student.extensionCount || 0} {student.extensionCount === 1 ? 'vez' : 'veces'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowExtensionModal(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <span className="text-xl">🔄</span>
              Extender Vigencia del Estudiante
            </button>
          </div>
        </div>
      </div>

        {/* Estado OnHold del Estudiante - Solo mostrar si el contrato NO está finalizado */}
        {!contratoFinalizado && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">⏸️ Estado OnHold</h3>
            <StudentOnHold
              studentId={student._id}
              peopleId={student.peopleId}
              numeroId={student.numeroId}
              estadoInactivo={student.estadoInactivo || false}
              currentFechaOnHold={student.fechaOnHold}
              currentFechaFinOnHold={student.fechaFinOnHold}
              onHoldCount={student.onHoldCount}
              onHoldHistory={student.onHoldHistory}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {contractGroups.map((group, index) => (
          <div
            key={index}
            className={`border-2 rounded-lg p-4 ${group.color}`}
          >
            <h4 className="font-semibold text-gray-800 mb-3 text-sm">
              Grupo {index + 1}: {group.title}
            </h4>
            <div className="space-y-2">
              {group.fields.map((field, fieldIndex) => (
                <div key={fieldIndex}>
                  <label className="block text-xs font-medium text-gray-600">
                    {field.label}
                  </label>
                  <p className="text-sm text-gray-900">{field.value || 'No especificado'}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Relationship Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">Relación con el Estudiante</h4>
        <p className="text-sm text-gray-600">
          El titular del contrato <strong>{contractHolder.primerNombre} {contractHolder.primerApellido}</strong>
          {' '}es el responsable financiero de la educación de <strong>{student.primerNombre} {student.primerApellido}</strong>.
        </p>
        <div className="mt-3 text-xs text-gray-500">
          <p>• Contrato: {contractHolder.contrato}</p>
          <p>• Vigencia: {formatDate(contractHolder.vigencia)}</p>
          <p>• Beneficiario: {student.primerNombre} {student.primerApellido} (ID: {student.numeroId})</p>
        </div>
      </div>

      {/* Modal de Extensión de Vigencia */}
      {showExtensionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                📅 Extender Vigencia del Estudiante
              </h3>
              <button
                onClick={() => {
                  setShowExtensionModal(false)
                  setMotivoExtension('')
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Información Actual</h4>
                <div className="space-y-1 text-sm">
                  <p className="text-green-800">
                    <strong>Estudiante:</strong> {student.primerNombre} {student.primerApellido}
                  </p>
                  <p className="text-green-800">
                    <strong>ID:</strong> {student.numeroId}
                  </p>
                  <p className="text-green-800">
                    <strong>Vigencia actual:</strong> {student.finalContrato ? new Date(student.finalContrato).toLocaleDateString('es-ES') : 'No disponible'}
                  </p>
                  <p className="text-green-800">
                    <strong>Días restantes:</strong> {student.vigencia || 'No disponible'} días
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📅 Nueva Fecha Final <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={nuevaFechaFinal}
                  onChange={(e) => setNuevaFechaFinal(e.target.value)}
                  min={student.finalContrato ? new Date(new Date(student.finalContrato).getTime() + 86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Debe ser posterior a la fecha actual de vigencia
                </p>
              </div>

              {nuevaFechaFinal && student.finalContrato && (
                <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Días a extender:</strong>{' '}
                    {Math.ceil((new Date(nuevaFechaFinal).getTime() - new Date(student.finalContrato).getTime()) / (1000 * 60 * 60 * 24))} días
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  💬 Motivo de la Extensión (opcional)
                </label>
                <textarea
                  value={motivoExtension}
                  onChange={(e) => setMotivoExtension(e.target.value)}
                  placeholder="Ej: Extensión individual por cambio de nivel, extensión por vacaciones, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowExtensionModal(false)
                  setMotivoExtension('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                disabled={isExtendingVigencia}
              >
                Cancelar
              </button>
              <button
                onClick={handleExtendVigencia}
                disabled={isExtendingVigencia || !nuevaFechaFinal}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExtendingVigencia ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Extendiendo...
                  </>
                ) : (
                  <>
                    ✅ Aplicar Extensión
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial de Extensiones */}
      {showExtensionHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                📊 Historial de Extensiones - {student.primerNombre} {student.primerApellido}
              </h3>
              <button
                onClick={() => setShowExtensionHistory(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {student.extensionHistory && student.extensionHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800">
                      <strong>Total de extensiones:</strong> {student.extensionCount} {student.extensionCount === 1 ? 'vez' : 'veces'}
                    </p>
                  </div>

                  {student.extensionHistory.sort((a: any, b: any) => b.numero - a.numero).map((entry: any) => (
                    <div
                      key={entry.numero}
                      className="border-2 border-green-300 bg-green-50 rounded-lg p-5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-gray-700">#{entry.numero}</span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-200 text-green-800">
                            ✅ COMPLETADO
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Días extendidos</p>
                          <p className="text-lg font-bold text-green-600">{entry.diasExtendidos} días</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-600 font-medium text-sm">📅 Vigencia Anterior:</span>
                            <span className="text-gray-900 text-sm">
                              {new Date(entry.vigenciaAnterior).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-gray-600 font-medium text-sm">📅 Vigencia Nueva:</span>
                            <span className="text-gray-900 text-sm font-semibold">
                              {new Date(entry.vigenciaNueva).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-600 font-medium text-sm">🕐 Fecha Ejecución:</span>
                            <span className="text-gray-900 text-sm">
                              {new Date(entry.fechaEjecucion).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {entry.motivo && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-600 font-medium text-sm">💬 Motivo:</span>
                              <span className="text-gray-900 text-sm italic">
                                {entry.motivo}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-gray-500 text-lg">No hay historial de extensiones disponible</p>
                  <p className="text-gray-400 text-sm mt-2">Las extensiones se registrarán aquí automáticamente</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowExtensionHistory(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
