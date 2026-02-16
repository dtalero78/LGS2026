'use client'

import { signOut } from 'next-auth/react'
import {
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline'

interface StudentHeaderProps {
  profile: any
  isLoading: boolean
}

export default function StudentHeader({ profile, isLoading }: StudentHeaderProps) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 text-white animate-pulse">
        <div className="h-6 bg-white/20 rounded w-48 mb-2" />
        <div className="h-4 bg-white/20 rounded w-32" />
      </div>
    )
  }

  const nombre = profile?.primerNombre || ''
  const apellido = profile?.primerApellido || ''
  const nivel = profile?.nivel || ''
  const step = profile?.step || ''
  const plataforma = profile?.plataforma || ''

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 text-white">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hola, {nombre} {apellido}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-primary-100">
            <AcademicCapIcon className="h-5 w-5" />
            <span className="font-medium">{nivel} - {step}</span>
            {plataforma && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {plataforma}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Cerrar sesion"
        >
          <ArrowRightOnRectangleIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
