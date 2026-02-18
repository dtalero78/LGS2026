'use client'

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, isSameDay, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface Advisor {
  _id: string
  primerNombre: string
  primerApellido: string
}

interface CalendarEvent {
  _id: string
  dia: Date
  evento?: 'SESSION' | 'CLUB' | 'WELCOME'
  tipo?: string
  tituloONivel: string
  nombreEvento?: string
  advisor: string | Advisor
  advisorNombre?: string
  observaciones?: string
  limiteUsuarios: number
  linkZoom?: string
  inscritos?: number
  asistieron?: number
}

interface CalendarViewProps {
  currentMonth: Date
  events: CalendarEvent[]
  selectedDate: Date | null
  onDayClick: (date: Date) => void
  onMonthChange: (direction: 'prev' | 'next') => void
}

export default function CalendarView({
  currentMonth,
  events,
  selectedDate,
  onDayClick,
  onMonthChange
}: CalendarViewProps) {
  // Generar días del mes con días del mes anterior y siguiente para completar semanas
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // Encontrar el primer domingo antes o en el primer día del mes
  const calendarStart = new Date(monthStart)
  const dayOfWeek = getDay(monthStart)
  if (dayOfWeek !== 0) {
    calendarStart.setDate(monthStart.getDate() - dayOfWeek)
  }

  // Encontrar el último sábado después o en el último día del mes
  const calendarEnd = new Date(monthEnd)
  const endDayOfWeek = getDay(monthEnd)
  if (endDayOfWeek !== 6) {
    calendarEnd.setDate(monthEnd.getDate() + (6 - endDayOfWeek))
  }

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Función para obtener eventos de un día específico, ordenados por hora
  const getEventsForDay = (date: Date) => {
    return events
      .filter(event => isSameDay(new Date(event.dia), date))
      .sort((a, b) => {
        // Ordenar por hora (más temprano primero)
        const timeA = new Date(a.dia).getTime()
        const timeB = new Date(b.dia).getTime()
        return timeA - timeB
      })
  }

  // Resolver tipo de evento: soporta ambos campos (evento de Wix, tipo de Postgres)
  const getEventType = (event: CalendarEvent): string => {
    return event.evento || event.tipo || ''
  }

  // Función para obtener el color según el tipo de evento
  const getEventColor = (tipo: string) => {
    switch (tipo) {
      case 'SESSION':
        return 'bg-blue-100 text-blue-800'
      case 'CLUB':
        return 'bg-green-100 text-green-800'
      case 'WELCOME':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="card">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => onMonthChange('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => onMonthChange('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-900">
            {day}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const dayEvents = getEventsForDay(day)
          const isWeekendDay = isWeekend(day)

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`
                min-h-[120px] p-2 cursor-pointer transition-all
                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                ${isWeekendDay ? 'bg-gray-50' : ''}
                ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : ''}
                hover:bg-gray-100
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`
                  text-sm font-medium
                  ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                  ${isSelected ? 'text-primary-600' : ''}
                `}>
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Mostrar eventos del día */}
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event._id}
                    className={`text-xs px-1 py-0.5 rounded ${getEventColor(getEventType(event))}`}
                    title={`${getEventType(event)} - ${event.tituloONivel} ${event.nombreEvento || ''}\nAdvisor: ${event.advisorNombre || 'Sin asignar'}\nInscritos: ${event.inscritos || 0}/${event.limiteUsuarios}\nAsistieron: ${event.asistieron || 0}`}
                  >
                    <div className="truncate">
                      {format(new Date(event.dia), 'HH:mm')} {getEventType(event)}
                    </div>
                    <div className="truncate text-[10px] opacity-75">
                      {event.advisorNombre || 'Sin advisor'}
                    </div>
                    <div className="text-[10px] opacity-75 flex gap-1">
                      <span>👥 {event.inscritos || 0}/{event.limiteUsuarios}</span>
                      <span className="text-green-700">✓ {event.asistieron || 0}</span>
                    </div>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{dayEvents.length - 2} más
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-100"></span>
          <span className="text-gray-600">SESSION</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-100"></span>
          <span className="text-gray-600">CLUB</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-purple-100"></span>
          <span className="text-gray-600">WELCOME</span>
        </div>
      </div>
    </div>
  )
}