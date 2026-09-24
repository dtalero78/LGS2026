'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

/**
 * Mantenimiento › Avisos › Reglamentos.
 *
 * Reemplaza el PDF del Reglamento de Participantes (DI-010) que el estudiante
 * abre desde la opción "Reglamentos" de su panel. Publica al instante: el
 * archivo va a Spaces y el panel lo lee desde ahí, sin desplegar.
 */

const API = '/api/postgres/mantenimiento/reglamento'
/** La misma URL que consume el panel del estudiante — la vista previa muestra
 *  exactamente lo que él va a ver, no el archivo local. */
const VISOR = '/api/postgres/reglamento'

interface Estado {
  personalizado: boolean
  size: number | null
  lastModified: string | null
}

async function fetchEstado(): Promise<Estado> {
  const res = await fetch(API)
  // successResponse() aplana los campos en la raíz: { success, personalizado, ... }
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'No se pudo leer el estado')
  return { personalizado: !!json.personalizado, size: json.size ?? null, lastModified: json.lastModified ?? null }
}

const fmtPeso = (b: number | null) =>
  b == null ? '' : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`

export default function ReglamentosPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: estado, isLoading } = useQuery<Estado>('reglamento-estado', fetchEstado, {
    staleTime: 0,
  })

  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardado, setGuardado] = useState(false)
  // Cache-buster: tras publicar hay que forzar que el visor vuelva a pedir el
  // PDF, si no el iframe sigue mostrando el anterior.
  const [version, setVersion] = useState(0)

  const refrescar = (msg: string) => {
    queryClient.invalidateQueries('reglamento-estado')
    setArchivo(null)
    setVersion((v) => v + 1)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 3000)
    toast.success(msg)
  }

  const publicar = useMutation(
    async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(API, { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al publicar')
      return json
    },
    {
      onSuccess: () => refrescar('Reglamento publicado — los estudiantes ya ven la versión nueva'),
      onError: (e: any) => { toast.error(e.message || 'Error al publicar') },
    },
  )

  const restaurar = useMutation(
    async () => {
      const res = await fetch(API, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al restaurar')
      return json
    },
    {
      onSuccess: () => refrescar('Se restauró el reglamento original'),
      onError: (e: any) => { toast.error(e.message || 'Error al restaurar') },
    },
  )

  const trabajando = publicar.isLoading || restaurar.isLoading

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reelegir el mismo archivo
    if (!file) return

    const esPdf = /application\/pdf/i.test(file.type || '') || file.name.toLowerCase().endsWith('.pdf')
    if (!esPdf) return toast.error('El reglamento debe ser un archivo PDF')
    if (file.size > 20 * 1024 * 1024) return toast.error('El archivo no puede superar 20 MB')

    setArchivo(file)
  }

  const handlePublicar = () => {
    if (!archivo) return
    const ok = window.confirm(
      `¿Publicar "${archivo.name}" como Reglamento de Participantes?\n\n` +
      'Reemplaza de inmediato el documento que ven todos los estudiantes desde su panel.',
    )
    if (ok) publicar.mutate(archivo)
  }

  const handleRestaurar = () => {
    const ok = window.confirm(
      '¿Restaurar el reglamento original?\n\n' +
      'Se elimina la versión cargada y vuelve a mostrarse el PDF que viene con la plataforma.',
    )
    if (ok) restaurar.mutate()
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
          <DocumentTextIcon className="h-5 w-5 text-primary-600" />
          <h1 className="text-lg font-semibold text-gray-900">Reglamento de Participantes</h1>
        </div>
        {guardado && (
          <div className="ml-auto flex items-center gap-1.5 text-green-600 text-sm font-medium">
            <CheckCircleIcon className="h-4 w-4" />
            Guardado
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Qué se está sirviendo hoy */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Documento publicado
          </h2>

          {isLoading ? (
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                {estado?.personalizado ? (
                  <>
                    <p className="text-gray-900 font-medium">Versión cargada desde este panel</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtPeso(estado.size)}
                      {estado.lastModified && (
                        <> · publicada el {new Date(estado.lastModified).toLocaleString('es-CO')}</>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-900 font-medium">Reglamento original de la plataforma</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Nadie ha cargado una versión nueva todavía.
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`${VISOR}?v=${version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  Abrir
                </a>
                {estado?.personalizado && (
                  <button
                    type="button"
                    onClick={handleRestaurar}
                    disabled={trabajando}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Restaurar original
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vista previa: exactamente lo que abre el estudiante */}
          <object
            key={version}
            data={`${VISOR}?v=${version}`}
            type="application/pdf"
            className="w-full h-96 rounded-lg border border-gray-200 bg-gray-100"
          >
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Tu navegador no muestra el PDF aquí — usa el botón “Abrir”.
            </div>
          </object>
        </div>

        {/* Subir nueva versión */}
        <div className="card p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Publicar una versión nueva
          </h2>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg py-10 cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors"
          >
            <DocumentTextIcon className="h-10 w-10 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Haz clic para seleccionar el PDF</p>
            <p className="text-xs text-gray-400 mt-1">Solo PDF — máx. 20 MB</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            aria-label="Seleccionar el PDF del reglamento"
            onChange={elegirArchivo}
          />

          {archivo && (
            <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <DocumentTextIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="text-blue-900 font-medium truncate">{archivo.name}</span>
              <span className="text-blue-600 text-xs flex-shrink-0">{fmtPeso(archivo.size)}</span>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Al publicar, el documento queda visible de inmediato para todos los estudiantes en la
            opción <span className="font-medium">Reglamentos</span> de su panel. No hace falta
            desplegar. La versión anterior no se conserva.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handlePublicar}
            disabled={trabajando || !archivo}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {publicar.isLoading ? 'Publicando...' : 'Publicar reglamento'}
          </button>
        </div>

      </div>
    </div>
  )
}
