'use client'

import {
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ClassHistoryProps {
  data: any
  isLoading: boolean
}

export default function ClassHistory({ data, isLoading }: ClassHistoryProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-36 mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg mb-2" />
        ))}
      </div>
    )
  }

  const history = data?.history || []

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Historial de Clases ({history.length})
      </h3>
      {history.length === 0 ? (
        <p className="text-gray-400 text-sm">No hay historial de clases</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {history.map((cls: any) => {
            const date = cls.fechaEvento ? new Date(cls.fechaEvento) : null
            const asistio = cls.asistio
            const cancelo = cls.cancelo

            return (
              <div
                key={cls._id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-shrink-0">
                  {cancelo ? (
                    <MinusCircleIcon className="h-5 w-5 text-amber-500" />
                  ) : asistio === true ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  ) : asistio === false ? (
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                  ) : (
                    <MinusCircleIcon className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-semibold text-gray-500">
                      {cls.tipo || cls.tipoEvento || '—'}
                    </span>
                    <span className="text-gray-900 truncate">
                      {cls.nivel} - {cls.step}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {date ? format(date, "d MMM yyyy, HH:mm", { locale: es }) : 'Sin fecha'}
                    {cls.advisor && ` | ${cls.advisor}`}
                  </div>
                </div>
                {cls.calificacion && (
                  <span className="text-sm font-medium text-primary-600">
                    {cls.calificacion}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
