'use client'

import { useState, useEffect } from 'react'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

interface Material {
  index: number
  name: string
  url: string
}

interface SessionMaterialTabProps {
  eventoNombre: string
}

export default function SessionMaterialTab({ eventoNombre }: SessionMaterialTabProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMaterials()
  }, [eventoNombre])

  const loadMaterials = async () => {
    if (!eventoNombre) {
      console.warn('⚠️ No hay step definido para cargar material')
      return
    }

    try {
      setLoading(true)
      setError(null)
      console.log('📚 Cargando material para step:', eventoNombre)

      const response = await fetch(`/api/wix-proxy/nivel-material?step=${encodeURIComponent(eventoNombre)}`)

      if (!response.ok) throw new Error('Error al cargar material')

      const data = await response.json()

      if (data.success) {
        setMaterials(data.materials || [])
        console.log('✅ Material cargado:', data.materials?.length || 0, 'archivos')
      } else {
        throw new Error(data.error || 'Error al cargar material')
      }
    } catch (err) {
      console.error('❌ Error loading materials:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenMaterial = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <span className="ml-3 text-emerald-700">Cargando material...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <DocumentTextIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600">Error al cargar material: {error}</p>
          <button
            onClick={loadMaterials}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (materials.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No hay material disponible para este step</p>
          <p className="text-sm text-gray-500 mt-2">Step: {eventoNombre}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="bg-emerald-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-6 w-6 text-white" />
          <h3 className="text-lg font-bold text-white">Material del Step - {eventoNombre}</h3>
          <span className="ml-auto px-3 py-1 bg-white text-emerald-600 rounded-full text-sm font-semibold">
            {materials.length} {materials.length === 1 ? 'archivo' : 'archivos'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-emerald-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-emerald-900 uppercase tracking-wider">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-emerald-900 uppercase tracking-wider">
                Nombre del Archivo
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-emerald-900 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {materials.map((material) => (
              <tr
                key={material.index}
                className="hover:bg-emerald-50 transition-colors cursor-pointer"
                onClick={() => handleOpenMaterial(material.url)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {material.index}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium">{material.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenMaterial(material.url)
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-emerald-50 px-6 py-3 flex items-center gap-2 text-xs text-emerald-700 border-t border-emerald-200">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Haz clic en cualquier archivo para descargarlo</span>
      </div>
    </div>
  )
}
