'use client'

import { Student } from '@/types'

interface StudentWhatsAppProps {
  student: Student
}

export default function StudentWhatsApp({ student }: StudentWhatsAppProps) {
  return (
    <div className="space-y-6">
      {/* Contact Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">💬 Información de Contacto WhatsApp</h3>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Estudiante</label>
              <p className="mt-1 text-sm text-gray-900">
                {student.primerNombre} {student.primerApellido}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Número de Documento</label>
              <p className="mt-1 text-sm text-gray-900">{student.numeroId}</p>
            </div>
            {student.celular && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Celular Registrado</label>
                <p className="mt-1 text-sm text-gray-900">{student.celular}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado WhatsApp</label>
              <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-800">
                Activo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Messages */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">📱 Mensajes Rápidos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="font-medium text-gray-900">Recordatorio de Clase</div>
            <div className="text-sm text-gray-500 mt-1">
              Enviar recordatorio sobre la próxima clase programada
            </div>
          </button>
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="font-medium text-gray-900">Información de Progreso</div>
            <div className="text-sm text-gray-500 mt-1">
              Enviar actualización sobre el progreso académico
            </div>
          </button>
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="font-medium text-gray-900">Material de Estudio</div>
            <div className="text-sm text-gray-500 mt-1">
              Compartir material complementario para el nivel actual
            </div>
          </button>
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="font-medium text-gray-900">Felicitaciones</div>
            <div className="text-sm text-gray-500 mt-1">
              Enviar mensaje de felicitación por logros alcanzados
            </div>
          </button>
        </div>
      </div>

      {/* Custom Message */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">✏️ Mensaje Personalizado</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="custom-message" className="block text-sm font-medium text-gray-700">
              Mensaje
            </label>
            <textarea
              id="custom-message"
              rows={4}
              className="input-field"
              placeholder="Escribe tu mensaje personalizado aquí..."
            />
          </div>
          <div className="flex space-x-3">
            <button className="btn-primary">
              📤 Enviar Mensaje
            </button>
            <button className="btn-secondary">
              💾 Guardar Plantilla
            </button>
          </div>
        </div>
      </div>

      {/* Message History */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">📋 Historial de Mensajes</h3>
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-900">Recordatorio de clase</div>
                <div className="text-sm text-gray-500 mt-1">
                  Hola {student.primerNombre}, te recordamos que tienes clase mañana a las 10:00 AM con tu advisor.
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Hace 2 días
              </div>
            </div>
            <div className="mt-2">
              <span className="badge badge-success">Entregado</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-900">Felicitaciones por avance</div>
                <div className="text-sm text-gray-500 mt-1">
                  ¡Felicitaciones {student.primerNombre}! Has completado exitosamente el Step 3. ¡Sigue así!
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Hace 1 semana
              </div>
            </div>
            <div className="mt-2">
              <span className="badge badge-success">Entregado</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-900">Material de estudio</div>
                <div className="text-sm text-gray-500 mt-1">
                  Te comparto material adicional para reforzar los temas vistos en clase.
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Hace 2 semanas
              </div>
            </div>
            <div className="mt-2">
              <span className="badge badge-success">Entregado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}