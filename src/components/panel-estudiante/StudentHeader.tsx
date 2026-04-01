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
  const step = profile?.effectiveStep || profile?.step || ''

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
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
            type="button"
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
