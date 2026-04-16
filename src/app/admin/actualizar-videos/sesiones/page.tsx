'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeftIcon, AcademicCapIcon, ArrowUpTrayIcon, TrashIcon,
  PlayIcon, XMarkIcon, LinkIcon, CheckIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface StepRow {
  _id: string
  code: string
  step: string
  description?: string
  videoUrl: string | null   // DO Spaces key
  video?: string | null     // YouTube/external URL
}

type UploadingKey = string   // "{nivel}|{step}|{field}"

const NIVELES_CODES = [
  'WELCOME','BN1','BN2','BN3','P1','P2','P3','F1','F2','F3','F4','DONE','ESS'
]

export default function ActualizarVideosSesionesPage() {
  const [nivel, setNivel]           = useState('BN1')
  const [steps, setSteps]           = useState<StepRow[]>([])
  const [loading, setLoading]       = useState(false)
  const [uploading, setUploading]   = useState<UploadingKey | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<{ nivel: string; step: string; field: string } | null>(null)
  const [linkEdit, setLinkEdit]     = useState<{ step: string; value: string } | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { loadSteps(nivel) }, [nivel])

  const loadSteps = async (code: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/videos/sesiones?nivel=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.success) setSteps(d.steps || [])
    } catch { toast.error('Error al cargar steps') }
    finally { setLoading(false) }
  }

  // ── Upload MP4 ──────────────────────────────────────────────────────────────
  const handleUpload = async (nivel: string, step: string, file: File) => {
    if (!file.type.startsWith('video/')) { toast.error('Solo archivos de video'); return }
    const key = `${nivel}|${step}|videoUrl`
    setUploading(key)
    try {
      const fd = new FormData()
      fd.append('nivel', nivel)
      fd.append('step',  step)
      fd.append('file',  file)
      const r = await fetch('/api/admin/videos/sesiones', { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error')
      toast.success('Video subido')
      await loadSteps(nivel)
    } catch (e: any) { toast.error(e.message || 'Error al subir') }
    finally { setUploading(null) }
  }

  // ── Save external link ──────────────────────────────────────────────────────
  const handleSaveLink = async (nivel: string, step: string, url: string) => {
    try {
      const r = await fetch('/api/admin/videos/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel, step, video: url }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error')
      toast.success('Enlace guardado')
      setLinkEdit(null)
      await loadSteps(nivel)
    } catch (e: any) { toast.error(e.message || 'Error al guardar') }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) return
    const { nivel: n, step: s, field: f } = confirmDel
    try {
      const params = new URLSearchParams({ nivel: n, step: s, field: f })
      const r = await fetch(`/api/admin/videos/sesiones?${params}`, { method: 'DELETE' })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error')
      toast.success('Eliminado')
      setConfirmDel(null)
      await loadSteps(n)
    } catch (e: any) { toast.error(e.message || 'Error al eliminar') }
  }

  // ── Preview ─────────────────────────────────────────────────────────────────
  const openPreview = (row: StepRow) => {
    if (row.videoUrl) {
      setPreviewSrc(`/api/postgres/niveles/video?nivel=${encodeURIComponent(row.code)}&step=${encodeURIComponent(row.step)}`)
    } else if (row.video) {
      setPreviewSrc(row.video)
    }
  }

  const isYouTube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be')

  const toEmbedUrl = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/)
    return m ? `https://www.youtube.com/embed/${m[1]}` : url
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => window.close()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeftIcon className="h-4 w-4" /> Cerrar
          </button>
          <AcademicCapIcon className="h-6 w-6 text-purple-600" />
          <h1 className="text-xl font-bold text-gray-900">Videos — Sesiones</h1>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-gray-500">Nivel:</label>
            <select
              value={nivel}
              onChange={e => setNivel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {NIVELES_CODES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : steps.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No se encontraron steps para {nivel}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">Step</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">Video MP4 (Spaces)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">Enlace Externo (YouTube)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-purple-900 uppercase tracking-wider">Vista Previa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {steps.map(row => {
                  const uploadKey = `${row.code}|${row.step}|videoUrl`
                  const isUploadingThis = uploading === uploadKey
                  const isEditingLink   = linkEdit?.step === row.step
                  return (
                    <tr key={row._id} className="hover:bg-purple-50 transition-colors">
                      {/* Step */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 text-sm">{row.step}</span>
                      </td>

                      {/* Video MP4 */}
                      <td className="px-6 py-4">
                        <input
                          ref={el => { fileInputRefs.current[uploadKey] = el }}
                          type="file" accept="video/*" className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleUpload(row.code, row.step, file)
                            e.target.value = ''
                          }}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          {row.videoUrl
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                ✓ Cargado
                              </span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                                Sin video
                              </span>
                          }
                          <button
                            onClick={() => fileInputRefs.current[uploadKey]?.click()}
                            disabled={isUploadingThis}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          >
                            {isUploadingThis
                              ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Subiendo</>
                              : <><ArrowUpTrayIcon className="h-3 w-3" /> {row.videoUrl ? 'Reemplazar' : 'Subir'}</>
                            }
                          </button>
                          {row.videoUrl && (
                            <button
                              onClick={() => setConfirmDel({ nivel: row.code, step: row.step, field: 'videoUrl' })}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar video"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* External link */}
                      <td className="px-6 py-4">
                        {isEditingLink ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={linkEdit.value}
                              onChange={e => setLinkEdit(s => s ? { ...s, value: e.target.value } : null)}
                              placeholder="https://youtu.be/..."
                              className="w-48 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                              onClick={() => handleSaveLink(row.code, row.step, linkEdit.value)}
                              className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              <CheckIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setLinkEdit(null)}
                              className="p-1.5 text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {row.video
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full truncate max-w-[140px]" title={row.video}>
                                  <LinkIcon className="h-3 w-3 flex-shrink-0" /> {row.video.length > 25 ? row.video.substring(0, 25) + '…' : row.video}
                                </span>
                              : <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full">Sin enlace</span>
                            }
                            <button
                              onClick={() => setLinkEdit({ step: row.step, value: row.video || '' })}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <LinkIcon className="h-3 w-3" /> {row.video ? 'Editar' : 'Agregar'}
                            </button>
                            {row.video && (
                              <button
                                onClick={() => setConfirmDel({ nivel: row.code, step: row.step, field: 'video' })}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar enlace"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Preview */}
                      <td className="px-6 py-4 text-right">
                        {(row.videoUrl || row.video) && (
                          <button
                            onClick={() => openPreview(row)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <PlayIcon className="h-3.5 w-3.5" /> Ver
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Eliminar el {confirmDel.field === 'videoUrl' ? 'video MP4' : 'enlace externo'} de <strong>{confirmDel.step}</strong>?
              {confirmDel.field === 'videoUrl' && ' El archivo también será borrado de DO Spaces.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-3xl bg-black rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
              <span className="text-white text-sm font-medium">Vista previa — {nivel}</span>
              <button onClick={() => setPreviewSrc(null)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              {isYouTube(previewSrc) ? (
                <iframe
                  src={toEmbedUrl(previewSrc)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video key={previewSrc} src={previewSrc} controls autoPlay className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
