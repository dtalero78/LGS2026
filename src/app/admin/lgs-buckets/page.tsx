'use client'

/**
 * /admin/lgs-buckets — Visor de fotos en DO Spaces (lgs-bucket).
 *
 * v1 sólo lectura: ver + descargar fotos de advisors (ADVISORS.fotoAdvisor) y
 * de usuarios (ACADEMICA.foto). No sube ni borra. Gated por
 * MANTENIMIENTO.LGS_BUCKETS.VER (SUPER_ADMIN/ADMIN bypass).
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CircleStackIcon, ArrowPathIcon, MagnifyingGlassIcon,
  ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, UserCircleIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { MantenimientoPermission } from '@/types/permissions'
import { api, handleApiError } from '@/hooks/use-api'

interface FotoItem {
  id: string
  nombre: string
  email: string
  numeroId?: string
  nivel?: string
  step?: string
  filename: string | null
  url: string | null
}

const PAGE_SIZE = 24

async function descargar(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = filename || 'foto.jpg'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
  } catch {
    // Fallback: abrir en nueva pestaña (el usuario guarda manualmente)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function FotoCard({ item }: { item: FotoItem }) {
  const [broken, setBroken] = useState(false)
  const fname = item.filename || `${item.nombre}.jpg`
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col">
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {item.url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.nombre}
            className="w-full h-full object-cover"
            onError={() => setBroken(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center text-gray-300">
            <UserCircleIcon className="h-16 w-16" />
            <span className="text-[10px] text-gray-400 mt-1">
              {item.url ? 'No disponible' : 'Sin foto en Spaces'}
            </span>
          </div>
        )}
      </div>
      <div className="p-2 flex-1 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-900 truncate" title={item.nombre}>{item.nombre}</p>
        {item.numeroId ? <p className="text-[11px] text-gray-500 truncate">ID {item.numeroId}</p> : null}
        {item.email ? <p className="text-[11px] text-gray-500 truncate" title={item.email}>{item.email}</p> : null}
        {item.nivel ? <p className="text-[11px] text-gray-400 truncate">{item.nivel}{item.step ? ` · ${item.step}` : ''}</p> : null}
        <div className="mt-auto pt-1 flex items-center gap-1.5">
          <button
            type="button"
            disabled={!item.url}
            onClick={() => item.url && descargar(item.url, fname)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Descargar
          </button>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" /> Abrir
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LgsBucketsPage() {
  const [tab, setTab] = useState<'advisors' | 'usuarios'>('advisors')

  // Advisors
  const [advisors, setAdvisors] = useState<FotoItem[]>([])
  const [advisorsLoaded, setAdvisorsLoaded] = useState(false)

  // Usuarios
  const [usuarios, setUsuarios] = useState<FotoItem[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchAdvisors = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ advisors: FotoItem[] }>('/api/admin/lgs-buckets/advisors')
      setAdvisors(data.advisors || [])
      setAdvisorsLoaded(true)
    } catch (err) {
      handleApiError(err, 'Error cargando fotos de advisors')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsuarios = useCallback(async (resetPage = false) => {
    setLoading(true)
    try {
      const pageToUse = resetPage ? 1 : page
      const qs = new URLSearchParams()
      if (search.trim()) qs.set('search', search.trim())
      qs.set('page', String(pageToUse))
      qs.set('pageSize', String(PAGE_SIZE))
      const data = await api.get<{ usuarios: FotoItem[]; total: number }>(`/api/admin/lgs-buckets/usuarios?${qs.toString()}`)
      setUsuarios(data.usuarios || [])
      setTotal(data.total || 0)
      if (resetPage) setPage(1)
    } catch (err) {
      handleApiError(err, 'Error cargando fotos de usuarios')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  // Carga inicial de advisors
  useEffect(() => { fetchAdvisors() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al entrar al tab Usuarios la primera vez, cargar
  useEffect(() => {
    if (tab === 'usuarios' && usuarios.length === 0 && total === 0) fetchUsuarios(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Paginación usuarios
  useEffect(() => {
    if (tab === 'usuarios') fetchUsuarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const items = tab === 'advisors' ? advisors : usuarios

  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.LGS_BUCKETS} showDefaultMessage>
        <div className="max-w-7xl mx-auto p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CircleStackIcon className="h-7 w-7 text-indigo-600" />
                Lgs-Buckets
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Fotos almacenadas en DO Spaces (lgs-bucket). Visualización y descarga.
              </p>
            </div>
            <button
              type="button"
              onClick={() => tab === 'advisors' ? fetchAdvisors() : fetchUsuarios()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200">
            {([['advisors', 'Fotos Advisors'], ['usuarios', 'Fotos Usuarios']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
                {k === 'advisors' && advisorsLoaded ? ` (${advisors.length})` : ''}
                {k === 'usuarios' && total ? ` (${total})` : ''}
              </button>
            ))}
          </div>

          {/* Búsqueda (solo usuarios) */}
          {tab === 'usuarios' && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchUsuarios(true) }}
                  placeholder="Buscar por nombre, ID o email…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchUsuarios(true)}
                className="px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Buscar
              </button>
            </div>
          )}
          {tab === 'usuarios' && (
            <p className="text-[11px] text-gray-400 -mt-3">
              Solo se muestran fotos almacenadas en Spaces. Las fotos legacy de Wix no son accesibles y se omiten.
            </p>
          )}

          {/* Grid */}
          {loading ? (
            <p className="p-10 text-sm text-gray-400 italic text-center">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="p-10 text-sm text-gray-400 italic text-center">
              {tab === 'advisors' ? 'No hay fotos de advisors.' : 'No hay fotos de usuarios con ese filtro.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {items.map(it => <FotoCard key={it.id} item={it} />)}
            </div>
          )}

          {/* Paginación (solo usuarios) */}
          {tab === 'usuarios' && usuarios.length > 0 && (
            <div className="flex items-center justify-between text-sm pt-2">
              <span className="text-gray-500 text-xs">
                {((page - 1) * PAGE_SIZE) + 1} – {Math.min(page * PAGE_SIZE, total)} de {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-700">Página {page} de {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
