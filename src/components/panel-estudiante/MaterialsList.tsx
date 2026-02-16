'use client'

import { ArrowDownTrayIcon, BookOpenIcon } from '@heroicons/react/24/outline'

interface MaterialsListProps {
  data: any
  isLoading: boolean
}

export default function MaterialsList({ data, isLoading }: MaterialsListProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg mb-2" />
        ))}
      </div>
    )
  }

  const materials = data?.materials || []
  const nivel = data?.nivel || ''

  // Collect all material items from all steps
  const allMaterials: { name: string; url: string; step: string }[] = []
  for (const row of materials) {
    const matList = row.material || row.materiales || []
    if (Array.isArray(matList)) {
      for (const m of matList) {
        if (m && m.url) {
          allMaterials.push({
            name: m.name || m.nombre || `Material ${allMaterials.length + 1}`,
            url: m.url,
            step: row.step || '',
          })
        }
      }
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Material - {nivel}
      </h3>
      {allMaterials.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <BookOpenIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay material disponible para tu nivel</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {allMaterials.map((mat, idx) => (
            <a
              key={idx}
              href={mat.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-primary-50 transition-colors group"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200">
                <ArrowDownTrayIcon className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{mat.name}</p>
                <p className="text-xs text-gray-500">{mat.step}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
