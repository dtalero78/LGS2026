'use client'

/**
 * /admin/lgs-buckets — Visor de fotos en DO Spaces (lgs-bucket).
 *
 * v1 sólo lectura: ver + descargar fotos de advisors (ADVISORS.fotoAdvisor) y
 * de usuarios (ACADEMICA.foto). No sube ni borra. Gated por
 * MANTENIMIENTO.LGS_BUCKETS.VER (SUPER_ADMIN/ADMIN bypass).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  CircleStackIcon, ArrowPathIcon, MagnifyingGlassIcon,
  ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, UserCircleIcon, ArrowUpTrayIcon,
  PencilSquareIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { MantenimientoPermission } from '@/types/permissions'
import { api, handleApiError } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/usePermissions'

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

function FotoCard({ item, tipo, canEdit, onReplaced, onEditData }: {
  item: FotoItem
  tipo: 'advisor' | 'usuario'
  canEdit: boolean
  onReplaced: (id: string, url: string, filename: string | null) => void
  onEditData?: () => void
}) {
  const [broken, setBroken] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fname = item.filename || `${item.nombre}.jpg`

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('tipo', tipo)
      fd.append('id', item.id)
      fd.append('file', f)
      const res = await fetch('/api/admin/lgs-buckets/replace', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.details || json?.error || `Error ${res.status}`)
      toast.success('Foto reemplazada')
      setBroken(false)
      onReplaced(item.id, json.url, json.filename ?? null)
    } catch (err: any) {
      toast.error(`No se pudo reemplazar: ${err?.message || ''}`)
    } finally {
      setUploading(false)
    }
  }

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
        {onEditData ? (
          <button
            type="button"
            onClick={onEditData}
            title="Editar datos del advisor"
            className="text-left text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline truncate inline-flex items-center gap-1"
          >
            <PencilSquareIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.nombre}</span>
          </button>
        ) : (
          <p className="text-xs font-semibold text-gray-900 truncate" title={item.nombre}>{item.nombre}</p>
        )}
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
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
              className="hidden"
              aria-label={`Reemplazar foto de ${item.nombre}`}
              title="Reemplazar foto"
              onChange={handleFile}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="mt-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-800 bg-amber-100 rounded hover:bg-amber-200 disabled:opacity-50"
            >
              <ArrowUpTrayIcon className="h-3.5 w-3.5" /> {uploading ? 'Subiendo…' : 'Reemplazar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface AdvisorForm {
  primerNombre: string
  primerApellido: string
  email: string
  numeroId: string
  telefono: string
  pais: string
  zoom: string
  domicilio: string
  fechaNacimiento: string
  esPlanta: boolean
  clave: string
}

const EMPTY_FORM: AdvisorForm = {
  primerNombre: '', primerApellido: '', email: '', numeroId: '', telefono: '',
  pais: '', zoom: '', domicilio: '', fechaNacimiento: '', esPlanta: false, clave: '',
}

/** Modal para editar los datos del advisor (los mismos que captura /nuevo-advisor). */
function AdvisorEditModal({ advisorId, advisorNombre, onClose, onSaved }: {
  advisorId: string
  advisorNombre: string
  onClose: () => void
  onSaved: (id: string, nombre: string, email: string) => void
}) {
  const [form, setForm] = useState<AdvisorForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tieneUsuarioRol, setTieneUsuarioRol] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await api.get<{ advisor: AdvisorForm & { tieneUsuarioRol: boolean } }>(`/api/postgres/advisors/${advisorId}`)
        if (!active) return
        const a = data.advisor
        setForm({
          primerNombre: a.primerNombre || '', primerApellido: a.primerApellido || '',
          email: a.email || '', numeroId: a.numeroId || '', telefono: a.telefono || '',
          pais: a.pais || '', zoom: a.zoom || '', domicilio: a.domicilio || '',
          fechaNacimiento: a.fechaNacimiento || '', esPlanta: a.esPlanta === true, clave: '',
        })
        setTieneUsuarioRol(a.tieneUsuarioRol)
      } catch (err) {
        handleApiError(err, 'No se pudieron cargar los datos del advisor')
        if (active) onClose()
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisorId])

  const set = (k: keyof AdvisorForm, v: string) => setForm(f => ({ ...f, [k]: v }))
  const onlyDigits = (v: string) => v.replace(/\D/g, '')
  const noSpaces = (v: string) => v.replace(/\s/g, '')
  const idClean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9-]/g, '')

  const save = async () => {
    setError(null)
    if (!form.primerNombre.trim()) return setError('El primer nombre es requerido')
    if (!form.primerApellido.trim()) return setError('El primer apellido es requerido')
    const email = form.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('El correo no es válido. Debe contener @ y un dominio, sin espacios')
    if (form.clave && form.clave.length < 4) return setError('La clave debe tener al menos 4 caracteres')
    setSaving(true)
    try {
      const res = await fetch(`/api/postgres/advisors/${advisorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.details || json?.error || `Error ${res.status}`)
      toast.success('Datos del advisor actualizados')
      onSaved(advisorId, json.nombre || `${form.primerNombre} ${form.primerApellido}`.trim(), json.email || email)
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <PencilSquareIcon className="h-5 w-5 text-indigo-600" /> Editar advisor
          </h2>
          <button type="button" onClick={onClose} title="Cerrar" className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="p-10 text-sm text-gray-400 italic text-center">Cargando…</p>
        ) : (
          <div className="p-5 space-y-3">
            <p className="text-[11px] text-gray-400">{advisorNombre}</p>
            {!tieneUsuarioRol && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Este advisor no tiene cuenta de login asociada (USUARIOS_ROLES). Se editan solo los datos de ADVISORS; el número de identificación y la clave no se guardarán.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primer nombre *" value={form.primerNombre} onChange={v => set('primerNombre', v)} />
              <Field label="Primer apellido *" value={form.primerApellido} onChange={v => set('primerApellido', v)} />
            </div>
            <Field label="Email *" value={form.email} onChange={v => set('email', noSpaces(v))} type="email" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número de identificación" value={form.numeroId} onChange={v => set('numeroId', idClean(v))} disabled={!tieneUsuarioRol} />
              <Field label="Celular / Teléfono" value={form.telefono} onChange={v => set('telefono', onlyDigits(v))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País" value={form.pais} onChange={v => set('pais', v)} />
              <Field label="Fecha de nacimiento" value={form.fechaNacimiento} onChange={v => set('fechaNacimiento', v)} type="date" />
            </div>
            <Field label="Link de Zoom" value={form.zoom} onChange={v => set('zoom', v)} />
            <Field label="Domicilio" value={form.domicilio} onChange={v => set('domicilio', v)} />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.esPlanta}
                onChange={e => setForm(f => ({ ...f, esPlanta: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700">Advisor de planta</span>
              <span className="text-xs text-gray-400">(en Control de Horas, Total Hours no descuenta sesiones sin asistentes)</span>
            </label>
            <Field
              label={tieneUsuarioRol ? 'Nueva clave (dejar en blanco para no cambiar)' : 'Clave (requiere cuenta de login)'}
              value={form.clave}
              onChange={v => set('clave', noSpaces(v))}
              type="password"
              disabled={!tieneUsuarioRol}
              placeholder={tieneUsuarioRol ? '••••' : ''}
            />
            <p className="text-[11px] text-gray-400">La foto se cambia con el botón "Reemplazar" de la tarjeta.</p>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={saving} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', disabled = false, placeholder = '' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-400"
      />
    </label>
  )
}

export default function LgsBucketsPage() {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission(MantenimientoPermission.LGS_BUCKETS_EDITAR)
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
  const [editing, setEditing] = useState<FotoItem | null>(null)
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

  const handleReplaced = (id: string, url: string, filename: string | null) => {
    const upd = (arr: FotoItem[]) => arr.map(it => it.id === id ? { ...it, url, filename } : it)
    if (tab === 'advisors') setAdvisors(upd)
    else setUsuarios(upd)
  }

  const handleAdvisorSaved = (id: string, nombre: string, email: string) => {
    setAdvisors(arr => arr.map(it => it.id === id ? { ...it, nombre, email } : it))
    setEditing(null)
  }

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
              {items.map(it => (
                <FotoCard
                  key={it.id}
                  item={it}
                  tipo={tab === 'advisors' ? 'advisor' : 'usuario'}
                  canEdit={canEdit}
                  onReplaced={handleReplaced}
                  onEditData={tab === 'advisors' && canEdit ? () => setEditing(it) : undefined}
                />
              ))}
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

          {editing && (
            <AdvisorEditModal
              advisorId={editing.id}
              advisorNombre={editing.nombre}
              onClose={() => setEditing(null)}
              onSaved={handleAdvisorSaved}
            />
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
