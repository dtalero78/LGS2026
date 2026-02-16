'use client'

import { ChatBubbleLeftEllipsisIcon, UserIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AdvisorCommentsProps {
  data: any
  isLoading: boolean
}

export default function AdvisorComments({ data, isLoading }: AdvisorCommentsProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg mb-2" />
        ))}
      </div>
    )
  }

  const comments = data?.comments || []

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Comentarios de Advisors
      </h3>
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <ChatBubbleLeftEllipsisIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay comentarios aun</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {comments.map((c: any) => {
            const date = c.fechaEvento ? new Date(c.fechaEvento) : null
            const comment = c.advisorAnotaciones || c.comentarios || ''

            return (
              <div key={c._id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {c.advisorNombre || c.advisor || 'Advisor'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {date ? format(date, 'd MMM yyyy', { locale: es }) : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-600 ml-6">{comment}</p>
                {c.calificacion && (
                  <div className="ml-6 mt-1">
                    <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                      Nota: {c.calificacion}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
