'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/outline'

interface Advisor {
  _id: string
  primerNombre: string
  primerApellido: string
  email?: string
  telefono?: string
  numeroId?: string
  zoom?: string
}

interface AdvisorsListProps {
  advisors: Advisor[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onAdvisorClick: (advisorId: string) => void
}

export default function AdvisorsList({
  advisors,
  loading,
  error,
  onRetry,
  onAdvisorClick
}: AdvisorsListProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrar advisors basado en el término de búsqueda
  const filteredAdvisors = advisors.filter(advisor => {
    const searchLower = searchTerm.toLowerCase()
    const fullName = `${advisor.primerNombre || ''} ${advisor.primerApellido || ''}`.toLowerCase()
    return fullName.includes(searchLower) ||
           (advisor.email || '').toLowerCase().includes(searchLower)
  })

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">Cargando advisors...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onRetry}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advisors Table */}
      {!loading && !error && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Lista de Advisors
              </h3>
              <span className="text-sm text-gray-500">
                {filteredAdvisors.length} de {advisors.length} advisor{filteredAdvisors.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {filteredAdvisors.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No se encontraron advisors
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Intenta con otro término de búsqueda.' : 'No hay advisors registrados en el sistema.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Advisor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zoom
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAdvisors.map((advisor) => (
                    <tr
                      key={advisor._id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onAdvisorClick(advisor._id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-700">
                                {(advisor.primerNombre?.[0] || '').toUpperCase()}
                                {(advisor.primerApellido?.[0] || '').toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {advisor.primerNombre} {advisor.primerApellido}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {advisor._id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {advisor.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {advisor.zoom ? (
                          <a
                            href={advisor.zoom}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-900 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver enlace
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}