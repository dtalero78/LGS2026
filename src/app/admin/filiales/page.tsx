'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { MantenimientoPermission } from '@/types/permissions'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

/**
 * Filiales — catálogo por plataforma para el alta de comerciales.
 * Se pueden agregar y eliminar. Cada filial pertenece a una plataforma.
 *
 * Permiso: MANTENIMIENTO.USUARIOS.CREAR_ROL (SUPER_ADMIN/ADMIN bypass).
 */

const PLATAFORMAS = ['Chile', 'Colombia', 'Ecuador', 'Perú']

interface Filial { _id: string; nombre: string; plataforma: string }

export default function FilialesPage() {
  const [plataforma, setPlataforma] = useState('')
  const [nombre, setNombre] = useState('')
  const [filiales, setFiliales] = useState<Filial[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (plat: string) => {
    if (!plat) { setFiliales([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/filiales?plataforma=${encodeURIComponent(plat)}`)
      const data = await res.json()
      if (res.ok && data.success) setFiliales(data.filiales || [])
      else setFiliales([])
    } catch { setFiliales([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(plataforma) }, [plataforma, load])

  const agregar = async () => {
    if (!plataforma) { toast.error('Selecciona una plataforma'); return }
    if (!nombre.trim()) { toast.error('Escribe el nombre de la filial'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/filiales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), plataforma }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      toast.success('Filial agregada')
      setNombre('')
      setFiliales(prev => [...prev, data.filial].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    } catch (e: any) { toast.error(e?.message || 'Error al agregar') }
    finally { setSaving(false) }
  }

  const eliminar = async (f: Filial) => {
    if (!confirm(`¿Eliminar la filial "${f.nombre}" de ${f.plataforma}?`)) return
    try {
      const res = await fetch(`/api/admin/filiales/${f._id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      toast.success('Filial eliminada')
      setFiliales(prev => prev.filter(x => x._id !== f._id))
    } catch (e: any) { toast.error(e?.message || 'Error al eliminar') }
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.CREAR_ROL}>
        <div className="max-w-3xl mx-auto py-8 space-y-4">
          <a href="/admin/roles/create" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="h-4 w-4" /> Volver
          </a>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Filiales</h1>
            <p className="text-sm text-gray-500 mt-0.5">Catálogo de filiales por plataforma para el alta de comerciales.</p>
          </div>

          {/* Formulario agregar */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="sm:w-52">
                <label htmlFor="plataforma" className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                <select id="plataforma" value={plataforma} onChange={e => setPlataforma(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">— Selecciona —</option>
                  {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre de la filial</label>
                <input id="nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') agregar() }}
                  disabled={!plataforma}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed" />
              </div>
              <button type="button" onClick={agregar} disabled={saving || !plataforma || !nombre.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-semibold">
                <PlusIcon className="h-4 w-4" /> {saving ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>

          {/* Lista */}
          <div>
            {!plataforma ? (
              <p className="text-sm text-gray-400 text-center py-8">Selecciona una plataforma para ver sus filiales.</p>
            ) : loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Cargando…</p>
            ) : filiales.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No hay filiales. Agrega la primera arriba.</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                {filiales.map(f => (
                  <div key={f._id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{f.nombre}</span>
                      <span className="text-xs text-gray-400 ml-2">{f.plataforma}</span>
                    </div>
                    <button type="button" onClick={() => eliminar(f)} title="Eliminar filial"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
                      <TrashIcon className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
