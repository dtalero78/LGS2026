'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeftIcon, VideoCameraIcon, PencilIcon, TrashIcon,
  ArrowUpTrayIcon, PlayIcon, XMarkIcon, CheckIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Instructivo {
  id: number
  title: string
  description: string
  videoKey: string | null
}

interface EditState { title: string; description: string }

export default function ActualizarVideosInstructivosPage() {
  const [instructivos, setInstructivos] = useState<Instructivo[]>([])
  const [loading, setLoading]           = useState(true)
  const [uploading, setUploading]       = useState<number | null>(null)
  const [editing, setEditing]           = useState<number | null>(null)
  const [editState, setEditState]       = useState<EditState>({ title: '', description: '' })
  const [previewKey, setPreviewKey]     = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => { loadInstructivos() }, [])

  const loadInstructivos = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/videos/instructivos')
      const d = await r.json()
      if (d.success) setInstructivos(d.instructivos)
    } catch { toast.error('Error al cargar instructivos') }
    finally { setLoading(false) }
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async (id: number, file: File) => {
    if (!file.type.startsWith('video/')) { toast.error('Solo se permiten archivos de video'); return }
    setUploading(id)
    try {
      const item = instructivos.find(i => i.id === id)!
      const fd   = new FormData()
      fd.append('id',          String(id))
      fd.append('title',       item.title)
      fd.append('description', item.description)
      fd.append('file',        file)

      const r = await fetch('/api/admin/videos/instructivos', { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error')
      toast.success('Video subido correctamente')
      await loadInstructivos()
    } catch (e: any) { toast.error(e.message || 'Error al subir video') }
    finally { setUploading(null) }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      const r = await fetch(`/api/admin/videos/instructivos?id=${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error')
      toast.success('Video eliminado')
      setConfirmDelete(null)
      await loadInstructivos()
    } catch (e: any) { toast.error(e.message || 'Error al eliminar') }
  }

  // ── Save metadata ───────────────────────────────────────────────────────────
  const handleSaveMeta = async (id: number) => {
    try {
      const r = await fetch('/api/admin/videos/instructivos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editState }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'Error')
      toast.success('Guardado')
      setEditing(null)
      await loadInstructivos()
    } catch (e: any) { toast.error(e.message || 'Error al guardar') }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => window.close()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeftIcon className="h-4 w-4" /> Cerrar
          </button>
          <VideoCameraIcon className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Videos — Instructivos</h1>
          <span className="ml-auto text-sm text-gray-400">{instructivos.length} instructivos</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {instructivos.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Card header */}
            <div className="bg-blue-600 px-6 py-4 flex items-center gap-3">
              <VideoCameraIcon className="h-5 w-5 text-white" />
              <span className="text-white font-semibold">{item.title}</span>
              <span className="ml-auto flex items-center gap-2">
                {item.videoKey
                  ? <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">Video cargado</span>
                  : <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded-full">Sin video</span>
                }
              </span>
            </div>

            <div className="p-6 space-y-4">
              {/* Metadata */}
              {editing === item.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
                    <input
                      value={editState.title}
                      onChange={e => setEditState(s => ({ ...s, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                    <input
                      value={editState.description}
                      onChange={e => setEditState(s => ({ ...s, description: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveMeta(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      <CheckIcon className="h-4 w-4" /> Guardar
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                    {item.videoKey && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">{item.videoKey}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditing(item.id); setEditState({ title: item.title, description: item.description }) }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                {/* Upload / Replace */}
                <input
                  ref={el => { fileInputRefs.current[item.id] = el }}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(item.id, file)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[item.id]?.click()}
                  disabled={uploading === item.id}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {uploading === item.id
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Subiendo...</>
                    : <><ArrowUpTrayIcon className="h-4 w-4" /> {item.videoKey ? 'Reemplazar' : 'Subir Video'}</>
                  }
                </button>

                {/* Preview */}
                {item.videoKey && (
                  <button
                    onClick={() => setPreviewKey(item.videoKey)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <PlayIcon className="h-4 w-4" /> Ver Video
                  </button>
                )}

                {/* Delete */}
                {item.videoKey && (
                  confirmDelete === item.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-600">¿Confirmar eliminación?</span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(item.id)}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 text-sm border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" /> Eliminar
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video Preview Modal */}
      {previewKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-3xl bg-black rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
              <span className="text-white text-sm font-medium">Vista previa</span>
              <button onClick={() => setPreviewKey(null)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <video
                key={previewKey}
                src={`/api/postgres/niveles/video?key=${encodeURIComponent(previewKey)}`}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
