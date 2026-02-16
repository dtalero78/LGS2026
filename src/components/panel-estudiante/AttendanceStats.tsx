'use client'

import {
  CheckCircleIcon,
  XCircleIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline'

interface AttendanceStatsProps {
  stats: any
  isLoading: boolean
}

export default function AttendanceStats({ stats, isLoading }: AttendanceStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  const data = stats || { asistencias: 0, ausencias: 0, canceladas: 0 }

  const cards = [
    {
      label: 'Asistencias',
      value: data.asistencias,
      icon: CheckCircleIcon,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Ausencias',
      value: data.ausencias,
      icon: XCircleIcon,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Canceladas',
      value: data.canceladas,
      icon: NoSymbolIcon,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} rounded-xl shadow-sm border border-gray-200 p-4 text-center`}
        >
          <card.icon className={`h-6 w-6 mx-auto ${card.color}`} />
          <div className={`text-2xl font-bold mt-1 ${card.color}`}>
            {card.value}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
        </div>
      ))}
    </div>
  )
}
