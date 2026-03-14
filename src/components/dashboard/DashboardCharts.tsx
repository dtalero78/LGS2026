'use client'

import { useState } from 'react'
import { useQuery } from 'react-query'
import { ChartBarIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface ChartsData {
  html: string
  generatedAt: string
  cached: boolean
}

async function fetchCharts(): Promise<ChartsData> {
  const res = await fetch('/api/postgres/dashboard/charts')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch charts')
  return { html: data.html, generatedAt: data.generatedAt, cached: data.cached }
}

async function regenerateCharts(): Promise<ChartsData> {
  const res = await fetch('/api/postgres/dashboard/charts', { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to regenerate charts')
  return { html: data.html, generatedAt: data.generatedAt, cached: data.cached }
}

export default function DashboardCharts() {
  const [regenerating, setRegenerating] = useState(false)

  const { data, isLoading, error, refetch } = useQuery<ChartsData>(
    'dashboard-charts',
    fetchCharts,
    {
      staleTime: 30 * 60 * 1000, // 30 min
      refetchInterval: 30 * 60 * 1000,
      retry: 1,
    }
  )

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const newData = await regenerateCharts()
      refetch() // refresh cache
    } catch (err) {
      console.error('Error regenerating charts:', err)
    } finally {
      setRegenerating(false)
    }
  }

  if (isLoading) {
    return <ChartsLoading />
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-center py-8">
          <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-3">No se pudieron cargar las gráficas</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!data?.html) return null

  const generatedDate = data.generatedAt
    ? new Date(data.generatedAt).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : ''

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Visualizaciones</h3>
        </div>
        <div className="flex items-center gap-3">
          {generatedDate && (
            <span className="text-xs text-gray-400">
              Generado: {generatedDate} {data.cached && '(caché)'}
            </span>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Regenerar gráficas con datos actualizados"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Generando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Charts HTML */}
      <div
        className="charts-container"
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </div>
  )
}

function ChartsLoading() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-gray-400 animate-pulse">
        Generando visualizaciones con IA... esto puede tomar unos segundos
      </p>
    </div>
  )
}
