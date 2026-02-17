'use client'

import { signOut } from 'next-auth/react'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

interface StudentHeaderProps {
  profile: any
  isLoading: boolean
}

export default function StudentHeader({ profile, isLoading }: StudentHeaderProps) {
  if (isLoading) {
    return (
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-4 bg-gray-200 rounded w-48" />
      </div>
    )
  }

  const nombre = profile?.primerNombre || ''
  const apellido = profile?.primerApellido || ''
  const nivel = profile?.nivel || ''
  const step = profile?.step || ''

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: WhatsApp help */}
        <a
          href="https://wa.me/573007654321?text=Hola%2C%20soy%20estudiante%20de%20LGS%20y%20necesito%20ayuda."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.316 0-4.468-.763-6.199-2.053l-.432-.328-2.633.883.883-2.633-.328-.432A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          <span className="hidden sm:inline">Necesitas ayuda?</span>
        </a>

        {/* Right: Greeting + nivel + logout */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">
            Hola, <span className="font-semibold">{nombre} {apellido}</span>
          </span>
          {nivel && (
            <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
              {nivel}{step ? ` - ${step}` : ''}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            title="Cerrar sesion"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
