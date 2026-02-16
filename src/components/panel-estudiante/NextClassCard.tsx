'use client'

import { useMemo } from 'react'
import {
  VideoCameraIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface NextClassCardProps {
  events: any[]
  isLoading: boolean
}

export default function NextClassCard({ events, isLoading }: NextClassCardProps) {
  const nextClass = useMemo(() => {
    if (!events || events.length === 0) return null
    // Events are already sorted by fechaEvento ASC from the API
    return events[0]
  }, [events])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-32 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-40" />
      </div>
    )
  }

  if (!nextClass) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Proxima Clase
        </h3>
        <p className="text-gray-400 text-sm">No tienes clases programadas</p>
      </div>
    )
  }

  const eventDate = new Date(nextClass.fechaEvento)
  const now = new Date()
  const minutesUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60)
  const minutesSince = -minutesUntil

  // Show Zoom link 5 min before to 10 min after
  const showZoom = minutesUntil <= 5 && minutesSince <= 10
  const zoomLink = nextClass.eventLinkZoom || nextClass.linkZoom

  const tipoColor = nextClass.tipo === 'SESSION'
    ? 'bg-blue-100 text-blue-800'
    : nextClass.tipo === 'CLUB'
    ? 'bg-green-100 text-green-800'
    : 'bg-purple-100 text-purple-800'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Proxima Clase
      </h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipoColor}`}>
            {nextClass.tipo || nextClass.tipoEvento}
          </span>
          <span className="text-sm text-gray-600">
            {nextClass.nivel} - {nextClass.step}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <span className="font-medium">
            {format(eventDate, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
          </span>
        </div>
        {nextClass.advisorNombre && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <UserIcon className="h-4 w-4 text-gray-400" />
            <span>{nextClass.advisorNombre}</span>
          </div>
        )}
        {showZoom && zoomLink && (
          <a
            href={zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <VideoCameraIcon className="h-4 w-4" />
            Entrar a Zoom
          </a>
        )}
      </div>
    </div>
  )
}
