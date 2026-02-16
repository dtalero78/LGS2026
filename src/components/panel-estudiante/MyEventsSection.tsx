'use client'

import {
  ClockIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CANCEL_DEADLINE_MINUTES = 60

interface MyEventsSectionProps {
  events: any[]
  isLoading: boolean
  onCancel: (bookingId: string) => void
  isCancelling: boolean
}

export default function MyEventsSection({
  events,
  isLoading,
  onCancel,
  isCancelling,
}: MyEventsSectionProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="h-5 bg-gray-200 rounded w-36 mb-4 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  // Show up to 4 upcoming events
  const upcomingEvents = (events || []).slice(0, 4)

  const tipoColor = (tipo: string) => {
    switch (tipo) {
      case 'SESSION': return 'border-l-blue-500'
      case 'CLUB': return 'border-l-green-500'
      case 'WELCOME': return 'border-l-purple-500'
      default: return 'border-l-gray-400'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Mis Proximas Clases
      </h3>
      {upcomingEvents.length === 0 ? (
        <p className="text-gray-400 text-sm">No tienes clases programadas</p>
      ) : (
        <div className="space-y-2">
          {upcomingEvents.map((evt: any) => {
            const eventDate = new Date(evt.fechaEvento)
            const now = new Date()
            const minutesUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60)
            const canCancel = minutesUntil >= CANCEL_DEADLINE_MINUTES

            return (
              <div
                key={evt._id}
                className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border-l-4 ${tipoColor(evt.tipo || evt.tipoEvento)}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <span className="text-xs font-semibold text-gray-500">
                      {evt.tipo || evt.tipoEvento}
                    </span>
                    <span className="truncate">
                      {evt.nivel} - {evt.step}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {format(eventDate, "EEE d MMM, HH:mm", { locale: es })}
                    </span>
                    {evt.advisorNombre && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3.5 w-3.5" />
                        {evt.advisorNombre}
                      </span>
                    )}
                  </div>
                </div>
                {canCancel && (
                  <button
                    onClick={() => onCancel(evt._id)}
                    disabled={isCancelling}
                    className="ml-2 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Cancelar clase"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
