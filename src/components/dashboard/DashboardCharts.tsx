'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from 'react-query'
import {
  ChartBarIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

interface ChartOption {
  key: string
  label: string
  description: string
}

interface ChartData {
  html: string
  generatedAt: string
  cached: boolean
}

const CHART_ICONS: Record<string, typeof ChartBarIcon> = {
  'sessions-vs-attendance': CalendarDaysIcon,
}

async function fetchChartOptions(): Promise<ChartOption[]> {
  const res = await fetch('/api/postgres/dashboard/charts')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed')
  return data.options || []
}

async function fetchChart(key: string): Promise<ChartData> {
  const res = await fetch(`/api/postgres/dashboard/charts?chart=${key}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed')
  return { html: data.html, generatedAt: data.generatedAt, cached: data.cached }
}

async function regenerateChart(key: string): Promise<ChartData> {
  const res = await fetch('/api/postgres/dashboard/charts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart: key }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed')
  return { html: data.html, generatedAt: data.generatedAt, cached: data.cached }
}

/** Renders interactive HTML in a sandboxed iframe that auto-resizes to content height */
function ChartsIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(400)

  const updateHeight = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument?.body) return
    const contentHeight = iframe.contentDocument.body.scrollHeight
    if (contentHeight > 100) setHeight(contentHeight + 20)
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    iframe.src = url

    const handleLoad = () => {
      updateHeight()
      setTimeout(updateHeight, 500)
      setTimeout(updateHeight, 1500)
    }

    iframe.addEventListener('load', handleLoad)
    return () => {
      iframe.removeEventListener('load', handleLoad)
      URL.revokeObjectURL(url)
    }
  }, [html, updateHeight])

  return (
    <iframe
      ref={iframeRef}
      style={{ width: '100%', height: `${height}px`, border: 'none', overflow: 'hidden' }}
      sandbox="allow-scripts"
      title="Dashboard Chart"
    />
  )
}

function ChartViewer({ chartKey, onBack }: { chartKey: string; onBack: () => void }) {
  const [regenerating, setRegenerating] = useState(false)

  const { data, isLoading, error, refetch } = useQuery<ChartData>(
    ['dashboard-chart', chartKey],
    () => fetchChart(chartKey),
    {
      staleTime: 30 * 60 * 1000,
      retry: 1,
    }
  )

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      await regenerateChart(chartKey)
      refetch()
    } catch (err) {
      console.error('Error regenerating chart:', err)
    } finally {
      setRegenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="text-sm text-primary-600 hover:text-primary-800 font-medium"
        >
          &larr; Volver
        </button>
        <div className="card p-6 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
        <p className="text-center text-xs text-gray-400 animate-pulse">
          Generando visualización con IA...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="text-sm text-primary-600 hover:text-primary-800 font-medium"
        >
          &larr; Volver
        </button>
        <div className="card p-6 text-center py-8">
          <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-3">No se pudo generar la gráfica</p>
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
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-primary-600 hover:text-primary-800 font-medium"
        >
          &larr; Volver a visualizaciones
        </button>
        <div className="flex items-center gap-3">
          {generatedDate && (
            <span className="text-xs text-gray-400">
              {data.cached ? 'Caché' : 'Generado'}: {generatedDate}
            </span>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Regenerar con datos actualizados"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Generando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <ChartsIframe html={data.html} />
    </div>
  )
}

export default function DashboardCharts() {
  const [selectedChart, setSelectedChart] = useState<string | null>(null)

  const { data: options, isLoading } = useQuery<ChartOption[]>(
    'dashboard-chart-options',
    fetchChartOptions,
    {
      staleTime: 60 * 60 * 1000, // 1 hour — options rarely change
      retry: 1,
    }
  )

  if (selectedChart) {
    return <ChartViewer chartKey={selectedChart} onBack={() => setSelectedChart(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ChartBarIcon className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">Visualizaciones</h3>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 w-56 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {(options || []).map((opt) => {
            const Icon = CHART_ICONS[opt.key] || ChartBarIcon
            return (
              <button
                key={opt.key}
                onClick={() => setSelectedChart(opt.key)}
                className="group flex items-center gap-3 px-5 py-3.5 bg-white border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 hover:shadow-sm transition-all text-left"
              >
                <Icon className="h-5 w-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-primary-700 transition-colors">
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 group-hover:text-primary-400 transition-colors">
                    {opt.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
