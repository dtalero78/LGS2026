'use client'

import { XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CANCEL_DEADLINE_MINUTES = 60

// Las sesiones de examen internacional no se pueden cancelar desde el panel.
const EXAM_NIVELES = ['IELTS', 'TOEFL', 'B2FIRST']
const esNivelExamen = (nivel?: string | null) => EXAM_NIVELES.includes(String(nivel ?? '').toUpperCase())

// Solo se muestran los eventos programados de las próximas 2 semanas desde hoy.
const HORIZON_DIAS = 14

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
        <div className="h-5 bg-gray-200 rounded w-44 mb-4 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  // Horizonte: hasta el final del día (hoy + 14 días). Eventos más lejanos se ocultan.
  const horizonte = new Date()
  horizonte.setHours(0, 0, 0, 0)
  horizonte.setDate(horizonte.getDate() + HORIZON_DIAS)
  horizonte.setHours(23, 59, 59, 999)
  const upcomingEvents = (events || []).filter((evt: any) => {
    const d = new Date(evt.fechaEvento)
    return isNaN(d.getTime()) || d <= horizonte
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Eventos programados:
      </h3>
      {upcomingEvents.length === 0 ? (
        <p className="text-gray-400 text-sm py-4">No tienes eventos programados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Evento</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Advisor</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-16">Cancelar</th>
              </tr>
            </thead>
            <tbody>
              {upcomingEvents.map((evt: any) => {
                const eventDate = new Date(evt.fechaEvento)
                const now = new Date()
                const minutesUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60)
                const isExamen = esNivelExamen(evt.nivel)
                const canCancel = minutesUntil >= CANCEL_DEADLINE_MINUTES && !isExamen

                return (
                  <tr key={evt._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">
                      {format(eventDate, "d MMM, HH:mm", { locale: es })}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="text-gray-900 font-medium">
                        {evt.tipo || evt.tipoEvento}
                      </span>
                      <span className="text-gray-500 ml-1">
                        {evt.nivel} - {evt.step}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-gray-600">
                      {evt.advisorNombre || '---'}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {canCancel ? (
                        <button
                          onClick={() => onCancel(evt._id)}
                          disabled={isCancelling}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Cancelar"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      ) : isExamen ? (
                        <span className="inline-flex items-center justify-center text-gray-400" title="Las sesiones de examen internacional no se pueden cancelar">
                          <LockClosedIcon className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {upcomingEvents.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-3">Solo se muestran los eventos de las próximas 2 semanas.</p>
      )}
    </div>
  )
}
