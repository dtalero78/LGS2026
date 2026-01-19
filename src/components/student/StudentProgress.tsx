'use client'

import { useState, useEffect } from 'react'
import { Student } from '@/types'

interface StudentProgressProps {
  student: Student
}

interface ProgressData {
  diagnosticoHTML: string
  estadisticas: {
    totalClases: number
    clasesAsistidas: number
    clasesConParticipacion: number
    porcentajeAsistencia: number
    porcentajeParticipacion: number
    stepsCompletados: number
    stepMasAlto: number
    tiposEvento: Record<string, number>
  }
  ultimasClases: Array<{
    fecha: string
    tipo: string
    nivel: string
    step: string
    asistio: boolean
    participo: boolean
    advisor?: string
  }>
  estudiante: {
    nombre: string
    nivel: string
    step: string
  }
}

export default function StudentProgress({ student }: StudentProgressProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProgressData()
  }, [student._id])

  const loadProgressData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('📊 Cargando diagnóstico académico para:', student._id)

      const response = await fetch(`/api/wix-proxy/student-progress?id=${student._id}`)

      if (!response.ok) {
        throw new Error('Error al cargar el diagnóstico académico')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al cargar el diagnóstico académico')
      }

      setProgressData(result.data)
      console.log('✅ Diagnóstico académico cargado:', result.data)

    } catch (err) {
      console.error('❌ Error cargando diagnóstico:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Cargando diagnóstico académico...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error al cargar el diagnóstico</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={loadProgressData}
                className="mt-3 btn-secondary text-sm"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!progressData) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-8">No hay datos disponibles</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* HTML Diagnóstico renderizado */}
      <div
        className="rounded-lg overflow-hidden shadow-sm"
        dangerouslySetInnerHTML={{ __html: progressData.diagnosticoHTML }}
      />

      {/* Botón para recargar */}
      <div className="flex justify-end">
        <button
          onClick={loadProgressData}
          className="btn-secondary text-sm"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Actualizando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </>
          )}
        </button>
      </div>
    </div>
  )
}
