'use client'

import { useState } from 'react'
import { Student } from '@/types'
import { formatDate } from '@/lib/utils'
import { MessageCircle, Loader2, Check, AlertCircle } from 'lucide-react'

interface StudentGeneralProps {
  student: Student
}

export default function StudentGeneral({ student }: StudentGeneralProps) {
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [whatsAppSent, setWhatsAppSent] = useState(false)
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null)

  const handleSendWhatsApp = async () => {
    if (!student.celular && !student.telefono) {
      setWhatsAppError('Este estudiante no tiene número de teléfono registrado')
      setTimeout(() => setWhatsAppError(null), 5000)
      return
    }

    setSendingWhatsApp(true)
    setWhatsAppError(null)

    try {
      const phoneNumber = student.celular || student.telefono
      const fullName = `${student.primerNombre} ${student.segundoNombre || ''} ${student.primerApellido} ${student.segundoApellido || ''}`.trim()

      const response = await fetch('/api/wix/sendWelcomeWhatsApp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          celular: phoneNumber,
          beneficiarioId: student._id,
          nombre: fullName
        })
      })

      const data = await response.json()

      if (data.success) {
        setWhatsAppSent(true)
        console.log('✅ WhatsApp enviado exitosamente')

        // Reset success state after 3 seconds
        setTimeout(() => setWhatsAppSent(false), 3000)
      } else {
        throw new Error(data.error || 'Error al enviar WhatsApp')
      }
    } catch (error: any) {
      console.error('❌ Error enviando WhatsApp:', error)
      setWhatsAppError(error.message || 'Error al enviar mensaje de WhatsApp')
      setTimeout(() => setWhatsAppError(null), 5000)
    } finally {
      setSendingWhatsApp(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Datos Personales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Primer Nombre</label>
              <p className="mt-1 text-sm text-gray-900">{student.primerNombre || 'No especificado'}</p>
            </div>
            {student.segundoNombre && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Segundo Nombre</label>
                <p className="mt-1 text-sm text-gray-900">{student.segundoNombre}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Primer Apellido</label>
              <p className="mt-1 text-sm text-gray-900">{student.primerApellido || 'No especificado'}</p>
            </div>
            {student.segundoApellido && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Segundo Apellido</label>
                <p className="mt-1 text-sm text-gray-900">{student.segundoApellido}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Número de Documento</label>
              <p className="mt-1 text-sm text-gray-900">{student.numeroId}</p>
            </div>
            {student.fechaNacimiento && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(student.fechaNacimiento)}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {student.celular && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Celular</label>
                  <button
                    onClick={handleSendWhatsApp}
                    disabled={sendingWhatsApp || whatsAppSent}
                    className={`
                      inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md
                      transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                      ${whatsAppSent
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                      }
                    `}
                  >
                    {sendingWhatsApp ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : whatsAppSent ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Enviado</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Mensaje de Bienvenida</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-900">{student.celular}</p>
              </div>
            )}
            {whatsAppError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{whatsAppError}</p>
              </div>
            )}
            {student.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{student.email}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo de Usuario</label>
              <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-800">
                {student.tipoUsuario}
              </span>
            </div>
            {student.plataforma && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Plataforma</label>
                <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {student.plataforma}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Academic Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Información Académica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nivel</label>
            <span className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
              {student.nivel}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Step Actual</label>
            <span className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent-100 text-accent-800">
              {student.step}
            </span>
          </div>
          {(student.claveLogin || student.clave) && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Clave Login</label>
              <span className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {student.claveLogin || student.clave}
              </span>
            </div>
          )}
          {student.asesor && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Asesor</label>
              <p className="mt-1 text-sm text-gray-900">{student.asesor}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contract Information */}
      {student.contrato && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Contrato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Número de Contrato</label>
              <p className="mt-1 text-sm text-gray-900">{student.contrato}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de Creación</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(student.fechaCreacion)}</p>
            </div>
          </div>
        </div>
      )}

      {/* System Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Sistema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">ID del Sistema</label>
            <p className="mt-1 text-sm text-gray-500 font-mono">{student._id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de Registro</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(student.fechaCreacion)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}