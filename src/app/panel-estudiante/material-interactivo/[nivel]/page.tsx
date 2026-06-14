'use client'

/**
 * /panel-estudiante/material-interactivo/[nivel]
 *
 * Visor de libro interactivo para el estudiante.
 *
 *  - Carga la metadata del nivel (total páginas + páginas con audio).
 *  - Renderiza la página actual usando presigned URL (10 min TTL).
 *  - Navegación: flechas ← →, swipe táctil, teclado.
 *  - Reproductor de audio inline cuando la página tiene audio.
 *  - Pre-fetch de las imágenes vecinas (n-1, n+1) para navegación instantánea.
 *
 * Reemplaza al link externo a Wix (`lgsplataforma.com/material-{nivel}`).
 * El botón "Material Interactivo (clásico)" sigue disponible mientras dure la
 * coexistencia controlada por feature flag.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SpeakerWaveIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
} from '@heroicons/react/24/outline'

interface AudioInfo {
  idx: number
  titulo: string | null
}

interface Metadata {
  available: boolean
  featureActive?: boolean
  previewMode?: boolean
  libroCodigo?: string
  libroTitulo?: string
  totalPaginas?: number
  paginasConAudio?: number[]
  /** Mapa pagina-local → lista de audios (nuevo, multi-audio). */
  audiosPorPagina?: Record<number, AudioInfo[]>
}

interface AudioPlayable {
  idx: number
  titulo: string | null
  url: string
}

export default function MaterialInteractivoPage() {
  const router = useRouter()
  const params = useParams<{ nivel: string }>()
  const nivel = (params?.nivel || '').toString().toUpperCase()

  // Modo preview: solo SUPER_ADMIN/ADMIN puede usarlo (el server valida).
  // Cuando preview=1 + admin → bypass del feature flag global.
  const isPreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('preview') === '1'
  const previewQsFirst = isPreview ? '?preview=1' : ''

  const [meta, setMeta] = useState<Metadata | null>(null)
  const [page, setPage] = useState(1)
  const [imageCache, setImageCache] = useState<Record<number, string>>({})
  const [audios, setAudios] = useState<AudioPlayable[]>([])
  const [zoomed, setZoomed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)
  // Páginas que ya reintentamos tras un error de carga (evita loop infinito).
  // Se limpia por página al cargar OK, así una expiración posterior puede reintentar.
  const retryRef = useRef<Set<number>>(new Set())

  // 1) Carga metadata — con reintento si BD esta saturada (500 esporadico)
  useEffect(() => {
    let cancelled = false
    setError(null)

    const load = async () => {
      for (let i = 0; i < 3; i++) {
        try {
          const r = await fetch(`/api/postgres/libros-interactivos/${encodeURIComponent(nivel)}${previewQsFirst}`, { cache: 'no-store' })
          if (r.status === 500 && i < 2) {
            await new Promise(res => setTimeout(res, 1500 * (i + 1)))
            continue
          }
          const json: Metadata = await r.json()
          if (cancelled) return
          if (!json?.available) {
            setMeta({ available: false, featureActive: json?.featureActive })
          } else {
            setMeta(json)
          }
          return
        } catch (e) {
          if (i === 2) {
            if (!cancelled) setError('No se pudo cargar el material')
            return
          }
          await new Promise(res => setTimeout(res, 1500 * (i + 1)))
        }
      }
    }
    load()

    return () => { cancelled = true }
  }, [nivel, previewQsFirst])

  const total = meta?.totalPaginas ?? 0
  // Conteo de audios por página (lo usamos para decidir si fetch o no).
  const audiosPorPagina = meta?.audiosPorPagina || {}
  const cantidadAudiosPagina = useMemo(
    () => audiosPorPagina[page]?.length || 0,
    [audiosPorPagina, page]
  )

  // 2) Carga URL de la página actual + pre-cache vecinas
  useEffect(() => {
    if (!meta?.available || !total) return
    // ±2 páginas para aguantar navegación rápida (antes solo ±1).
    const targetPages = [page, page - 1, page + 1, page - 2, page + 2].filter(p => p >= 1 && p <= total)
    let cancelled = false

    ;(async () => {
      for (const p of targetPages) {
        if (imageCache[p]) continue
        try {
          const r = await fetch(`/api/postgres/libros-interactivos/${encodeURIComponent(nivel)}/page?n=${p}`)
          const j = await r.json()
          if (cancelled) return
          if (j?.success && j.url) {
            setImageCache(prev => ({ ...prev, [p]: j.url }))
            // Precarga el bitmap en la caché del navegador → cambio de página
            // instantáneo (no espera la descarga al renderizar el <img>).
            const im = new Image(); im.src = j.url
          }
        } catch { /* silent */ }
      }
    })()

    return () => { cancelled = true }
  }, [page, total, meta?.available, nivel, imageCache])

  // 3) Carga TODOS los audios de la página actual (puede haber varios)
  useEffect(() => {
    if (!meta?.available || !total || cantidadAudiosPagina === 0) {
      setAudios([])
      return
    }
    let cancelled = false
    fetch(`/api/postgres/libros-interactivos/${encodeURIComponent(nivel)}/audio?n=${page}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j?.available && Array.isArray(j.audios)) setAudios(j.audios)
        else setAudios([])
      })
      .catch(() => { if (!cancelled) setAudios([]) })
    return () => { cancelled = true }
  }, [page, cantidadAudiosPagina, meta?.available, total, nivel])

  // Cada página nueva arranca en modo "ajustar" (sin zoom).
  useEffect(() => { setZoomed(false) }, [page])

  // 4) Teclado: ← → para navegar, Esc para volver
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setPage(p => Math.max(1, p - 1))
      if (e.key === 'ArrowRight') setPage(p => Math.min(total, p + 1))
      if (e.key === 'Escape')     router.push('/panel-estudiante')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, router])

  // 5) Swipe táctil
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (zoomed) return            // en zoom el gesto hace pan, no navega
    if (Math.abs(dx) < 50) return
    if (dx > 0)      setPage(p => Math.max(1, p - 1))
    else             setPage(p => Math.min(total, p + 1))
  }

  // Auto-reparación: si la imagen falla (presigned URL expirado o fallo
  // transitorio), pedimos una URL fresca una vez por página.
  const refreshPageUrl = async (p: number) => {
    try {
      const r = await fetch(`/api/postgres/libros-interactivos/${encodeURIComponent(nivel)}/page?n=${p}&_=${Date.now()}`)
      const j = await r.json()
      if (j?.success && j.url) setImageCache(prev => ({ ...prev, [p]: j.url }))
    } catch { /* silent */ }
  }
  const handleImgError = (p: number) => {
    if (retryRef.current.has(p)) return
    retryRef.current.add(p)
    refreshPageUrl(p)
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">No se pudo cargar el material</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button type="button" onClick={() => router.push('/panel-estudiante')} className="text-sm text-indigo-600 hover:underline">
            ← Volver al panel
          </button>
        </div>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Cargando libro…</div>
      </div>
    )
  }

  if (!meta.available) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Material interactivo no disponible
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {meta.featureActive === false
              ? 'La nueva versión todavía no está habilitada para tu nivel. Usa "Material Interactivo (clásico)" desde el panel.'
              : 'Tu nivel aún no tiene un libro interactivo configurado. Avisa al equipo académico.'}
          </p>
          <button type="button" onClick={() => router.push('/panel-estudiante')} className="text-sm text-indigo-600 hover:underline">
            ← Volver al panel
          </button>
        </div>
      </div>
    )
  }

  const currentUrl = imageCache[page]
  const canPrev = page > 1
  const canNext = page < (total || 0)

  return (
    <div
      className="min-h-screen bg-gray-100 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Banner Preview (solo admin que entró con ?preview=1) */}
      {meta.previewMode && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs text-center py-1.5 px-3">
          🧪 <strong>Modo PREVIEW</strong> — el feature flag está OFF; estás viendo el visor como admin. Los estudiantes todavía no lo ven.
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <button
          type="button"
          onClick={() => router.push('/panel-estudiante')}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Volver
        </button>
        <div className="text-sm">
          <span className="font-semibold text-gray-800">{meta.libroTitulo}</span>
          <span className="text-gray-500 ml-2">— {nivel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomed(z => !z)}
            title={zoomed ? 'Reducir' : 'Ampliar imagen'}
            aria-label={zoomed ? 'Reducir' : 'Ampliar imagen'}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
          >
            {zoomed ? <MagnifyingGlassMinusIcon className="h-5 w-5" /> : <MagnifyingGlassPlusIcon className="h-5 w-5" />}
          </button>
          <div className="text-xs text-gray-500 tabular-nums">
            Página <span className="font-bold text-gray-800">{page}</span> / {total}
          </div>
        </div>
      </div>

      {/* Audio + progreso — ARRIBA, siempre visible (antes estaba al fondo). */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 flex items-center gap-3">
        <SpeakerWaveIcon className="h-4 w-4 text-indigo-600 flex-shrink-0" />
        {audios.length > 0 ? (
          <div className="flex-1 flex flex-col gap-1.5 max-h-28 overflow-y-auto">
            {audios.map((a) => (
              <div key={a.url} className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 w-24 sm:w-32 truncate flex-shrink-0" title={a.titulo || `Audio ${a.idx + 1}`}>
                  {a.titulo || `Audio ${a.idx + 1}`}
                </span>
                <audio
                  src={a.url}
                  controls
                  autoPlay={false}
                  preload="metadata"
                  className="flex-1 max-w-md h-8"
                />
              </div>
            ))}
          </div>
        ) : (
          <span className="flex-1 text-xs text-gray-400">Esta página no tiene audio</span>
        )}
        <div className="hidden sm:block w-40 bg-gray-200 rounded-full h-1.5 overflow-hidden flex-shrink-0">
          <div
            className="bg-indigo-600 h-full transition-all"
            style={{ width: `${(page / (total || 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Visor — imagen grande directa sobre el fondo (sin tarjeta blanca),
          flechas overlay y tap-para-zoom. */}
      <div className={`relative flex-1 px-2 py-3 select-none ${zoomed ? 'overflow-auto' : 'overflow-hidden flex items-center justify-center'}`}>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={`Página ${page}`}
            onClick={() => setZoomed(z => !z)}
            onError={() => handleImgError(page)}
            onLoad={() => retryRef.current.delete(page)}
            draggable={false}
            className={zoomed
              ? 'block mx-auto max-w-none rounded-lg shadow-xl cursor-zoom-out'
              : 'max-h-[86vh] max-w-full object-contain rounded-lg shadow-xl cursor-zoom-in'}
            style={zoomed ? { width: '170%' } : undefined}
          />
        ) : (
          <div className="text-sm text-gray-400">Cargando página…</div>
        )}

        {!zoomed && (
          <>
            <button
              type="button"
              onClick={() => canPrev && setPage(p => p - 1)}
              disabled={!canPrev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-600/90 text-white shadow-lg disabled:opacity-25 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors flex items-center justify-center"
              aria-label="Página anterior"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => canNext && setPage(p => p + 1)}
              disabled={!canNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-600/90 text-white shadow-lg disabled:opacity-25 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors flex items-center justify-center"
              aria-label="Página siguiente"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 bg-white/80 rounded-full px-2 py-0.5 pointer-events-none">
              Toca la imagen para ampliar
            </div>
          </>
        )}
      </div>
    </div>
  )
}
