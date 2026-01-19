'use client'

import { useQuery } from 'react-query'
import { TrophyIcon } from '@heroicons/react/24/outline'

interface TopStudent {
  idEstudiante: string
  numeroId: string
  primerNombre: string
  primerApellido: string
  totalAsistencias: number
  nivel?: string
  plataforma?: string
}

export default function TopStudentsCard() {
  const { data, isLoading, error } = useQuery<{ topStudents: TopStudent[] }>(
    'top-students-month',
    fetchTopStudents,
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
    }
  )

  if (isLoading) {
    return <TopStudentsLoading />
  }

  if (error) {
    console.error('Top students error:', error)
  }

  const topStudents = data?.topStudents || []

  return (
    <div className="card p-6">
      <div className="flex items-center mb-4">
        <TrophyIcon className="h-8 w-8 text-yellow-500 mr-3" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Top 5 Estudiantes del Mes
          </h3>
          <p className="text-sm text-gray-500">
            Usuarios con más asistencias este mes
          </p>
        </div>
      </div>

      {topStudents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topStudents.map((student, index) => (
            <div
              key={student.idEstudiante}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {student.primerNombre} {student.primerApellido}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    {student.nivel && (
                      <span className="font-medium text-primary-600">{student.nivel}</span>
                    )}
                    {student.nivel && student.plataforma && <span>•</span>}
                    {student.plataforma && (
                      <span>{student.plataforma}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right ml-3">
                <p className="text-lg font-bold text-primary-600">
                  {student.totalAsistencias}
                </p>
                <p className="text-xs text-gray-500">
                  asistencias
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TopStudentsLoading() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-center mb-4">
        <div className="h-8 w-8 bg-gray-200 rounded mr-3"></div>
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
            <div className="h-6 bg-gray-200 rounded w-12"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function fetchTopStudents(): Promise<{ topStudents: TopStudent[] }> {
  try {
    const response = await fetch('/api/dashboard/top-students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data.success) {
      return {
        topStudents: data.topStudents || []
      }
    } else {
      throw new Error(data.error || 'Failed to fetch top students')
    }
  } catch (error) {
    console.error('Error fetching top students:', error)
    throw error
  }
}