'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PhotoIcon,
  CheckCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface BannerConfig {
  image: string | null
  active: boolean
  updatedBy: string | null
  updatedAt: string | null
}

const DEFAULT_BANNER: BannerConfig = { image: null, active: false, updatedBy: null, updatedAt: null }

async function fetchBanner(): Promise<BannerConfig> {
  try {
    const res = await fetch('/api/postgres/config/banner')
    if (!res.ok) return DEFAULT_BANNER
    const data = await res.json()
    return {
      image: data.image ?? null,
      active: data.active ?? false,
      updatedBy: data.updatedBy ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  } catch {
    return DEFAULT_BANNER
  }
}

async function saveBanner(payload: { image?: string; active?: boolean }) {
  const res = await fetch('/api/postgres/config/banner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Error al guardar el banner')
  return json
}

export default function BannerPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: current, isLoading } = useQuery<BannerConfig>('banner-config', fetchBanner, {
    staleTime: 0,
  })

  const [newImage, setNewImage] = useState<string | null>(null)
  const [imageTouched, setImageTouched] = useState(false)
  const [saved, setSaved] = useState(false)

  // Active toggle se guarda inmediatamente (igual que el ticker guarda sin confirmación de preview)
  const isActive = current?.active ?? false

  const mutation = useMutation(saveBanner, {
    onSuccess: () => {
      queryClient.invalidateQueries('banner-config')
      setSaved(true)
      setImageTouched(false)
      setNewImage(null)
      setTimeout(() => setSaved(false), 3000)
      toast.success('Banner actualizado')
    },
    onError: (err: any) => toast.error(err.message || 'Error al guardar'),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen')
      return
    }
    if (file.size > 7 * 1024 * 1024) {
      toast.error('La imagen no puede superar 7 MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setNewImage(ev.target?.result as string)
      setImageTouched(true)
    }
    reader.readAsDataURL(file)
    // reset input so the same file can be re-selected
    e.target.value = ''
  }

  const handleSave = () => {
    if (!newImage) return
    const confirmed = window.confirm(
      '¿Confirmas publicar esta imagen como banner en la página de login?'
    )
    if (!confirmed) return
    mutation.mutate({ image: newImage })
  }

  const handleRemoveCurrent = () => {
    if (!window.confirm('¿Eliminar la imagen actual del banner?')) return
    mutation.mutate({ image: '' })
  }

  const handleToggleActive = (value: boolean) => {
    if (!window.confirm(`¿${value ? 'Activar' : 'Desactivar'} la visualización del banner en el login?`)) return
    mutation.mutate({ active: value })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Volver al Dashboard
        </Link>
        <div className="h-4 w-px bg-gray-300" />
        <div className="flex items-center gap-2">
          <PhotoIcon className="h-5 w-5 text-primary-600" />
          <h1 className="text-lg font-semibold text-gray-900">Editor de Banner</h1>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-1.5 text-green-600 text-sm font-medium">
            <CheckCircleIcon className="h-4 w-4" />
            Guardado
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Imagen actual en producción */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Imagen actual en producción
          </h2>

          {isLoading ? (
            <div className="h-40 bg-gray-100 rounded animate-pulse" />
          ) : current?.image ? (
            <>
              <BannerPreview image={current.image} />
              <div className="flex items-center justify-between">
                <div>
                  {current.updatedBy && (
                    <p className="text-xs text-gray-400">
                      Última actualización por <span className="font-medium">{current.updatedBy}</span>
                      {current.updatedAt && (
                        <> · {new Date(current.updatedAt).toLocaleString('es-CO')}</>
                      )}
                    </p>
                  )}
                  <p className="text-xs mt-0.5">
                    Estado:{' '}
                    <span className={isActive ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      {isActive ? '✅ Activo — visible en el login' : '⏸ Desactivado'}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCurrent}
                  disabled={mutation.isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Eliminar imagen
                </button>
              </div>
            </>
          ) : (
            <div className="h-24 flex items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
              No hay imagen cargada
            </div>
          )}
        </div>

        {/* Toggle activo / inactivo */}
        <div className="card p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Visualización en login</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {isActive
                ? 'El banner está activo y se muestra en el login.'
                : 'El banner está desactivado.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleActive(!isActive)}
            disabled={mutation.isLoading || isLoading}
            title={isActive ? 'Desactivar banner' : 'Activar banner'}
            aria-label={isActive ? 'Desactivar banner' : 'Activar banner'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isActive ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Subir nueva imagen */}
        <div className="card p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Subir nueva imagen
          </h2>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg py-10 cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors"
          >
            <PhotoIcon className="h-10 w-10 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Haz clic para seleccionar una imagen</p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WEBP — máx. 7 MB</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Seleccionar imagen para el banner"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={mutation.isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Seleccionar imagen
          </button>
        </div>

        {/* Preview de la nueva imagen */}
        {imageTouched && newImage && (
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Vista previa del resultado
            </h2>
            <BannerPreview image={newImage} />
          </div>
        )}

        {/* Guardar y publicar */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={mutation.isLoading || !imageTouched || !newImage}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isLoading ? 'Guardando...' : 'Guardar y publicar'}
          </button>
        </div>

      </div>
    </div>
  )
}

function BannerPreview({ image }: { image: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-900 flex items-center justify-center">
      <img
        src={image}
        alt="Preview del banner"
        className="w-full max-h-64 object-contain"
      />
    </div>
  )
}
