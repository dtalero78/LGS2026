'use client'

import { Person } from '@/types'

interface PersonContactProps {
  person: Person
}

export default function PersonContact({ person }: PersonContactProps) {
  // Real contact data from person object with fallbacks
  const contactInfo = {
    telefonoFijo: (person as any).telefono || 'No disponible',
    referencias: {
      personal: {
        nombre: (person as any).referenciaUno || 'No disponible',
        telefono: (person as any).telRefUno || 'No disponible',
        relacion: (person as any).parentezcoRefUno || 'No disponible'
      },
      comercial: {
        nombre: (person as any).referenciaDos || 'No disponible',
        telefono: (person as any).telRefDos || 'No disponible',
        contacto: (person as any).parentezcoRefDos || 'No disponible'
      },
      familiar: {
        nombre: (person as any).referenciaUno || 'No disponible',
        telefono: (person as any).telRefUno || 'No disponible',
        relacion: (person as any).parentezcoRefUno || 'No disponible'
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Primary Contact Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">📞 Información de Contacto Principal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {person.celular && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Celular Principal</label>
                <p className="mt-1 text-sm text-gray-900">{person.celular}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono Fijo</label>
              <p className="mt-1 text-sm text-gray-900">{contactInfo.telefonoFijo}</p>
            </div>
          </div>
          <div className="space-y-4">
            {person.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Principal</label>
                <p className="mt-1 text-sm text-gray-900">{person.email}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">🏠 Información de Domicilio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección Completa</label>
            <p className="mt-1 text-sm text-gray-900">{person.domicilio || 'No especificado'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ciudad</label>
            <p className="mt-1 text-sm text-gray-900">{person.ciudad || 'No especificado'}</p>
          </div>
        </div>
      </div>

      {/* Personal References */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">👥 Referencias Personales</h3>
        <div className="space-y-6">
          {/* Personal Reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-3">Referencia Personal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-blue-700">Nombre Completo</label>
                <p className="text-sm text-blue-900">{contactInfo.referencias.personal.nombre}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-700">Teléfono</label>
                <p className="text-sm text-blue-900">{contactInfo.referencias.personal.telefono}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-700">Relación</label>
                <p className="text-sm text-blue-900">{contactInfo.referencias.personal.relacion}</p>
              </div>
            </div>
          </div>

          {/* Family Reference */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 mb-3">Referencia Familiar</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-purple-700">Nombre Completo</label>
                <p className="text-sm text-purple-900">{contactInfo.referencias.familiar.nombre}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-700">Teléfono</label>
                <p className="text-sm text-purple-900">{contactInfo.referencias.familiar.telefono}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-700">Relación</label>
                <p className="text-sm text-purple-900">{contactInfo.referencias.familiar.relacion}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}