'use client'

import {
  CheckCircleIcon,
  XMarkIcon,
  HandThumbDownIcon,
} from '@heroicons/react/24/solid'

interface AttendanceStatsProps {
  stats: any
  isLoading: boolean
}

export default function AttendanceStats({ stats, isLoading }: AttendanceStatsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 rounded-xl p-4 animate-pulse bg-gray-100">
            <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    )
  }

  const data = stats || { asistencias: 0, ausencias: 0, canceladas: 0 }

  const cards = [
    {
      label: 'Completaste',
      value: data.asistencias,
      suffix: 'sesiones',
      icon: CheckCircleIcon,
      bg: 'bg-green-500',
      iconColor: 'text-white',
    },
    {
      label: 'Cancelaste',
      value: data.canceladas,
      suffix: 'sesiones',
      icon: XMarkIcon,
      bg: 'bg-amber-500',
      iconColor: 'text-white',
    },
    {
      label: 'No asististe',
      value: data.ausencias,
      suffix: 'sesiones',
      icon: HandThumbDownIcon,
      bg: 'bg-slate-700',
      iconColor: 'text-white',
    },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex-1 ${card.bg} rounded-xl p-4 text-white flex items-center gap-3`}
        >
          <card.icon className={`h-8 w-8 flex-shrink-0 ${card.iconColor}`} />
          <div>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-sm opacity-90">
              {card.label} {card.value !== 1 ? card.suffix : 'sesion'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
