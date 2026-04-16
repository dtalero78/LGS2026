'use client'

import { useState, useEffect } from 'react'
import { BookOpenIcon } from '@heroicons/react/24/outline'

interface Material {
  index: number
  name: string
  url: string
}

interface Props {
  /** Step name, e.g. "Step 3" */
  step: string
  /** Nivel code, e.g. "BN1" */
  nivel: string
}

export default function SessionAdvisorMaterialTab({ step, nivel }: Props) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => { loadMaterials() }, [step, nivel])

  const loadMaterials = async () => {
    if (!step) return
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ step, tipo: 'advisor' })
      if (nivel) params.set('nivel', nivel)
      const r = await fetch(`/api/postgres/materials/nivel?${params}`)
      if (!r.ok) throw new Error('Error al cargar material')
      const data = await r.json()
      if (data.success) setMaterials(data.materials || [])
      else throw new Error(data.error || 'Error al cargar material')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  const label = nivel && step ? `${nivel} — ${step}` : step || '…'

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
          <span className="ml-3 text-amber-700">Cargando material...</span>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <BookOpenIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">Error al cargar material: {error}</p>
        <button
          onClick={loadMaterials}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (materials.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No hay material de advisor disponible para este step</p>
        <p className="text-sm text-gray-500 mt-2">{label}</p>
      </div>
    )
  }

  // ── Content ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-amber-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <BookOpenIcon className="h-6 w-6 text-white" />
          <h3 className="text-lg font-bold text-white">Material del Advisor — {label}</h3>
          <span className="ml-auto px-3 py-1 bg-white text-amber-600 rounded-full text-sm font-semibold">
            {materials.length} {materials.length === 1 ? 'archivo' : 'archivos'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-amber-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Nombre del Archivo</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-amber-900 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {materials.map(mat => (
              <tr
                key={mat.index}
                className="hover:bg-amber-50 transition-colors cursor-pointer"
                onClick={() => handleOpen(mat.url)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{mat.index}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium">{mat.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={e => { e.stopPropagation(); handleOpen(mat.url) }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 px-6 py-3 flex items-center gap-2 text-xs text-amber-700 border-t border-amber-200">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Haz clic en cualquier archivo para abrirlo</span>
      </div>
    </div>
  )
}
