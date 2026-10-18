'use client'

import { useQuery } from 'react-query'
import {
  ArrowDownTrayIcon,
  BookOpenIcon,
  SparklesIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import { getEtapaForNivel } from '@/lib/etapas'
import { libroV2PorEtapa } from '@/lib/libros-v2-catalogo'

function normalizeNivelCode(nivel: string): string {
  return (nivel || '').replace(/\s*JUMP\s*/i, '').trim().toUpperCase()
}

interface MaterialsListProps {
  data: any
  isLoading: boolean
}

export default function MaterialsList({ data, isLoading }: MaterialsListProps) {
  const materials = data?.materials || []
  const nivel = data?.nivel || ''
  const nivelNormalizado = normalizeNivelCode(nivel)
  // WELCOME es onboarding: no tiene material ni ejercicios de práctica.
  const isWelcome = nivelNormalizado === 'WELCOME'

  // Feature flag check: ¿está disponible el visor v2 (LGS) para este nivel?
  // React Query con staleTime 5 min — evita queries innecesarias en navegacion
  // interna y re-renders del componente. Solo refetch al cabo de 5 min o al
  // hacer un hard refresh del navegador.
  const { data: libroData } = useQuery(
    ['libros-interactivos-availability', nivelNormalizado],
    () =>
      fetch(`/api/postgres/libros-interactivos/${encodeURIComponent(nivelNormalizado)}`)
        .then(r => r.json())
        .catch(() => ({ available: false })),
    {
      enabled: Boolean(nivelNormalizado),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  )
  // Book ESS New: el servidor decide (interruptor + alumno activo en ESS · Step 0).
  const { data: bookEss } = useQuery(
    ['book-ess-estado'],
    () =>
      fetch('/api/postgres/panel-estudiante/book-ess/estado')
        .then(r => r.json())
        .catch(() => ({ disponible: false })),
    {
      enabled: nivelNormalizado === 'ESS',
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    }
  )
  const bookEssDisponible: boolean = nivelNormalizado === 'ESS' && Boolean(bookEss?.disponible)
  // New Books v2 (BEGINNER / PRACTICAL / FUNCTIONAL): el libro de la etapa del alumno.
  const libroNuevo = libroV2PorEtapa(getEtapaForNivel(nivelNormalizado))
  const { data: libroNuevoEstado } = useQuery(
    ['libro-v2-estado', libroNuevo?.slug],
    () =>
      fetch(`/api/postgres/panel-estudiante/libro-v2/${libroNuevo!.slug}/estado`)
        .then(r => r.json())
        .catch(() => ({ disponible: false })),
    {
      enabled: Boolean(libroNuevo),
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    }
  )
  const libroNuevoDisponible: boolean = Boolean(libroNuevo && libroNuevoEstado?.disponible)
  const v2Available: boolean = Boolean(libroData?.available)
  // Fase 2 — ejercicios de práctica (flag independiente).
  const ejerciciosActivo: boolean = Boolean(libroData?.ejerciciosActivo)

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

  // Collect all material items from all steps
  const allMaterials: { name: string; url: string; step: string }[] = []
  const seen = new Set<string>()

  for (const row of materials) {
    // Only materialUsuario: DO Spaces keys like "materials/..."
    const userMats = row.materialUsuario || []
    if (Array.isArray(userMats)) {
      for (const key of userMats) {
        if (typeof key === 'string' && key.startsWith('materials/') && !seen.has(key)) {
          seen.add(key)
          const filename = decodeURIComponent(key.split('/').pop() || key)
          allMaterials.push({
            name: filename.replace(/\.pdf$/i, ''),
            url: `/api/postgres/niveles/material?key=${encodeURIComponent(key)}`,
            step: row.step || '',
          })
        }
      }
    }
  }

  // Para WELCOME no se muestra material ni ejercicios.
  const shownMaterials = isWelcome ? [] : allMaterials

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Material - {nivel}
      </h3>

      {/* Book ESS New — libro ESSENTIAL con actividades (interruptor en Mantenimiento) */}
      {bookEssDisponible && (
        <a
          href="/panel-estudiante/book-ess"
          className="flex items-center gap-3 p-3 mb-3 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors group border border-indigo-200"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200">
            <SparklesIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-900">Book ESS New</p>
            <p className="text-xs text-indigo-600">Libro Essential con actividades y avance</p>
          </div>
        </a>
      )}

      {/* New Books v2 — Book BEG / PRA / FUNC New según la etapa (interruptor en Mantenimiento) */}
      {libroNuevoDisponible && libroNuevo && (
        <a
          href={`/panel-estudiante/book-new/${libroNuevo.slug}`}
          className="flex items-center gap-3 p-3 mb-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group border border-blue-200"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200">
            <SparklesIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">{libroNuevo.menu}</p>
            <p className="text-xs text-blue-600">Libro {libroNuevo.nivel} con historias, checkpoints y avance</p>
          </div>
        </a>
      )}

      {/* v2 (LGS) — solo si el flag global está ON y el nivel tiene libro configurado */}
      {v2Available && !isWelcome && (
        <a
          href={`/panel-estudiante/material-interactivo/${encodeURIComponent(nivelNormalizado)}`}
          className="flex items-center gap-3 p-3 mb-3 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors group border border-emerald-200"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200">
            <SparklesIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900">Material Interactivo</p>
            <p className="text-xs text-emerald-600">{nivelNormalizado} — nueva versión</p>
          </div>
        </a>
      )}

      {/* Fase 2 — Ejercicios de práctica (auto-gradables) del step actual */}
      {ejerciciosActivo && !isWelcome && (
        <a
          href="/panel-estudiante/ejercicios-interactivos"
          className="flex items-center gap-3 p-3 mb-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors group border border-amber-200"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200">
            <PencilSquareIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Ejercicios de práctica</p>
            <p className="text-xs text-amber-600">Practica tu step actual — sin nota</p>
          </div>
        </a>
      )}

      {shownMaterials.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <BookOpenIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay material disponible para tu nivel</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {shownMaterials.map((mat, idx) => (
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
