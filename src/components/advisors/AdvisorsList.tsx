'use client'

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, UserIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { AcademicoPermission } from '@/types/permissions'
import AdvisorEditModal from './AdvisorEditModal'

/**
 * Lazy-loads a presigned URL for the advisor's photo from DO Spaces.
 * Falls back to initials if no photo or load error.
 * `urlDirecta` (foto recién subida) tiene prioridad sobre la key.
 */
function AdvisorAvatar({ fotoKey, urlDirecta, initials }: { fotoKey: string | null | undefined; urlDirecta?: string; initials: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!fotoKey || urlDirecta) return
    fetch(`/api/postgres/materials/presigned?key=${encodeURIComponent(fotoKey)}`)
      .then(r => r.json())
      .then(d => { if (d.signedUrl) setUrl(d.signedUrl) })
      .catch(() => {})
  }, [fotoKey, urlDirecta])

  const src = urlDirecta || url
  if (src) {
    return <img src={src} alt={initials} className="h-10 w-10 rounded-full object-cover" />
  }

  return (
    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
      <span className="text-sm font-medium text-primary-700">{initials}</span>
    </div>
  )
}

interface Advisor {
  _id: string
  primerNombre: string
  primerApellido: string
  email?: string
  telefono?: string
  numeroId?: string
  zoom?: string
  fotoAdvisor?: string | null
  activo?: boolean | null
}

type FiltroEstado = 'activos' | 'inactivos' | 'todos'

interface AdvisorsListProps {
  advisors: Advisor[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onAdvisorClick: (advisorId: string) => void
  /** Refleja en la lista los datos guardados desde el modal de edición. */
  onAdvisorUpdated?: (advisorId: string, cambios: Partial<Advisor>) => void
}

const esActivo = (a: Advisor) => a.activo !== false

export default function AdvisorsList({
  advisors,
  loading,
  error,
  onRetry,
  onAdvisorClick,
  onAdvisorUpdated,
}: AdvisorsListProps) {
  const { hasPermission } = usePermissions()
  const puedeEditar = hasPermission(AcademicoPermission.ADVISOR_EDITAR)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstado>('activos')
  const [editando, setEditando] = useState<Advisor | null>(null)
  const [fotosNuevas, setFotosNuevas] = useState<Record<string, string>>({})

  const nombreDe = (a: Advisor) => `${a.primerNombre || ''} ${a.primerApellido || ''}`.trim()
  const nActivos = advisors.filter(esActivo).length
  const nInactivos = advisors.length - nActivos

  const porEstado = advisors.filter(a =>
    filtro === 'todos' ? true : filtro === 'activos' ? esActivo(a) : !esActivo(a))

  // Filtrar advisors basado en el estado y el término de búsqueda
  const filteredAdvisors = porEstado.filter(advisor => {
    const searchLower = searchTerm.toLowerCase()
    const fullName = nombreDe(advisor).toLowerCase()
    return fullName.includes(searchLower) ||
           (advisor.email || '').toLowerCase().includes(searchLower)
  })

  const opcionesEditar = [...porEstado].sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'))

  return (
    <div className="space-y-6">
      {/* Filtros: estado + editar advisor */}
      <div className="flex flex-wrap items-center gap-2">
        {([['activos', `Activos (${nActivos})`], ['inactivos', `Inactivos (${nInactivos})`], ['todos', `Todos (${advisors.length})`]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltro(k)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filtro === k
                ? k === 'inactivos' ? 'bg-red-600 border-red-600 text-white' : k === 'activos' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-primary-600 border-primary-600 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}

        {puedeEditar && (
          <div className="ml-auto flex items-center gap-2">
            <PencilSquareIcon className="h-5 w-5 text-indigo-600" />
            <select
              aria-label="Editar advisor"
              title="Editar advisor"
              value=""
              onChange={e => {
                const a = advisors.find(x => x._id === e.target.value)
                if (a) setEditando(a)
              }}
              className="min-w-[260px] rounded-md border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Editar perfil de un advisor…</option>
              {opcionesEditar.map(a => (
                <option key={a._id} value={a._id}>
                  {nombreDe(a) || a.email || a._id}{esActivo(a) ? '' : ' (inactivo)'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

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
                {filteredAdvisors.length} de {porEstado.length} advisor{porEstado.length !== 1 ? 's' : ''}
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
                {searchTerm ? 'Intenta con otro término de búsqueda.' : 'No hay advisors con ese estado.'}
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
                    {puedeEditar && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAdvisors.map((advisor) => (
                    <tr
                      key={advisor._id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${esActivo(advisor) ? '' : 'bg-red-50/40'}`}
                      onClick={() => onAdvisorClick(advisor._id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <AdvisorAvatar
                              fotoKey={advisor.fotoAdvisor}
                              urlDirecta={fotosNuevas[advisor._id]}
                              initials={`${(advisor.primerNombre?.[0] || '').toUpperCase()}${(advisor.primerApellido?.[0] || '').toUpperCase()}`}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {advisor.primerNombre} {advisor.primerApellido}
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                esActivo(advisor) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {esActivo(advisor) ? 'Activo' : 'Inactivo'}
                              </span>
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
                      {puedeEditar && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditando(advisor) }}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            <PencilSquareIcon className="h-4 w-4" /> Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editando && (
        <AdvisorEditModal
          advisorId={editando._id}
          advisorNombre={nombreDe(editando)}
          onClose={() => setEditando(null)}
          onSaved={(id, _nombre, email, datos) => {
            onAdvisorUpdated?.(id, { email, primerNombre: datos.primerNombre, primerApellido: datos.primerApellido, zoom: datos.zoom })
            setEditando(null)
          }}
          onFotoChanged={(id, url) => setFotosNuevas(m => ({ ...m, [id]: url }))}
        />
      )}
    </div>
  )
}
