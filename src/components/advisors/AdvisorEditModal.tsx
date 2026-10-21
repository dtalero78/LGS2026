'use client'

/**
 * Modal compartido para editar un advisor: los mismos datos que captura /nuevo-advisor
 * (ADVISORS + USUARIOS_ROLES) y la foto (DO Spaces). Lo usan /admin/lgs-buckets y la
 * lista de Advisors (/dashboard/academic/advisors).
 *
 * Backend: GET/PATCH /api/postgres/advisors/[id] y POST /api/admin/lgs-buckets/replace
 * (tipo=advisor). Gate: MANTENIMIENTO.LGS_BUCKETS.EDITAR o ACADEMICO.ADVISOR.EDITAR.
 */

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { PencilSquareIcon, XMarkIcon, UserCircleIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'

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

export default function AdvisorEditModal({ advisorId, advisorNombre, onClose, onSaved, onFotoChanged, onEstadoChanged, mostrarFoto = true }: {
  advisorId: string
  advisorNombre: string
  onClose: () => void
  onSaved: (id: string, nombre: string, email: string, datos: { primerNombre: string; primerApellido: string; zoom: string }) => void
  /** Se llama tras subir una foto nueva (url firmada para mostrarla de inmediato). */
  onFotoChanged?: (id: string, url: string, filename: string | null) => void
  /** Se llama tras activar/desactivar al advisor (se guarda al instante). */
  onEstadoChanged?: (id: string, activo: boolean) => void
  mostrarFoto?: boolean
}) {
  const [form, setForm] = useState<AdvisorForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tieneUsuarioRol, setTieneUsuarioRol] = useState(true)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<{
    activo: boolean; loginActivo: boolean | null; loginRol: string | null; clasesFuturas: number
    zoomLiberado: string | null; zoomLiberadoEn: string | null
  }>({ activo: true, loginActivo: null, loginRol: null, clasesFuturas: 0, zoomLiberado: null, zoomLiberadoEn: null })
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await api.get<{ advisor: AdvisorForm & {
          tieneUsuarioRol: boolean; fotoUrl: string | null
          activo: boolean; loginActivo: boolean | null; loginRol: string | null; clasesFuturas: number
          zoomLiberado: string | null; zoomLiberadoEn: string | null
        } }>(`/api/postgres/advisors/${advisorId}`)
        if (!active) return
        const a = data.advisor
        setForm({
          primerNombre: a.primerNombre || '', primerApellido: a.primerApellido || '',
          email: a.email || '', numeroId: a.numeroId || '', telefono: a.telefono || '',
          pais: a.pais || '', zoom: a.zoom || '', domicilio: a.domicilio || '',
          fechaNacimiento: a.fechaNacimiento || '', esPlanta: a.esPlanta === true, clave: '',
        })
        setTieneUsuarioRol(a.tieneUsuarioRol)
        setFotoUrl(a.fotoUrl || null)
        setEstado({
          activo: a.activo !== false, loginActivo: a.loginActivo ?? null, loginRol: a.loginRol ?? null, clasesFuturas: a.clasesFuturas || 0,
          zoomLiberado: a.zoomLiberado ?? null, zoomLiberadoEn: a.zoomLiberadoEn ?? null,
        })
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

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('tipo', 'advisor')
      fd.append('id', advisorId)
      fd.append('file', f)
      const res = await fetch('/api/admin/lgs-buckets/replace', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.details || json?.error || `Error ${res.status}`)
      setFotoUrl(json.url)
      onFotoChanged?.(advisorId, json.url, json.filename ?? null)
      toast.success('Foto actualizada')
    } catch (err: any) {
      toast.error(`No se pudo subir la foto: ${err?.message || ''}`)
    } finally {
      setSubiendo(false)
    }
  }

  // El login solo se sincroniza si la cuenta es de rol ADVISOR (un coordinador/jefe que
  // también figura como advisor conserva su acceso).
  const loginEsAdvisor = tieneUsuarioRol && String(estado.loginRol || '').toUpperCase() === 'ADVISOR'

  // Activa/desactiva al advisor (ficha + login) — se guarda al instante, aparte de "Guardar cambios".
  const cambiarEstado = async (activo: boolean) => {
    setCambiandoEstado(true)
    try {
      const res = await fetch(`/api/postgres/advisors/${advisorId}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.details || json?.error || `Error ${res.status}`)
      setEstado(e => ({
        ...e, activo, loginActivo: json.loginActualizado ? activo : e.loginActivo,
        // Al desactivar, el servidor libera la sala de Zoom: se refleja en el formulario.
        ...(!activo && form.zoom.trim() ? { zoomLiberado: form.zoom.trim(), zoomLiberadoEn: new Date().toISOString() } : {}),
      }))
      if (!activo) setForm(f => ({ ...f, zoom: '' }))
      setConfirmarDesactivar(false)
      onEstadoChanged?.(advisorId, activo)
      toast.success(activo
        ? `Advisor activado${json.loginActualizado ? ' · login habilitado' : ''}`
        : `Advisor desactivado${json.loginActualizado ? ' · login bloqueado' : ''}`)
    } catch (err: any) {
      toast.error(`No se pudo cambiar el estado: ${err?.message || ''}`)
    } finally {
      setCambiandoEstado(false)
    }
  }

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
      const evN = json.eventosActualizados || 0
      toast.success(evN > 0
        ? `Advisor actualizado · Zoom propagado a ${evN} clase(s) futura(s)`
        : 'Datos del advisor actualizados')
      onSaved(advisorId, json.nombre || `${form.primerNombre} ${form.primerApellido}`.trim(), json.email || email, {
        primerNombre: form.primerNombre.trim(), primerApellido: form.primerApellido.trim(), zoom: form.zoom.trim(),
      })
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
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

            {mostrarFoto && (
              <div className="flex items-center gap-4 rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="h-20 w-20 shrink-0 rounded-full overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                  {fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoUrl} alt={advisorNombre} className="h-full w-full object-cover" />
                  ) : (
                    <UserCircleIcon className="h-14 w-14 text-gray-300" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">Foto del advisor</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                    className="hidden"
                    aria-label="Subir foto del advisor"
                    title="Subir foto"
                    onChange={subirFoto}
                  />
                  <button
                    type="button"
                    disabled={subiendo}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-100 rounded hover:bg-amber-200 disabled:opacity-50"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" /> {subiendo ? 'Subiendo…' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                  </button>
                  <p className="text-[10px] text-gray-400">JPG, PNG, WEBP o HEIC · máx. 10 MB. Se guarda al instante.</p>
                </div>
              </div>
            )}

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
            <p className="text-[11px] text-gray-400 -mt-1">Al cambiar el Zoom se actualiza automáticamente en las clases futuras del advisor (eventos y bookings). No aplica a WELCOME.</p>
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

            {/* Estado del advisor: ficha (ADVISORS) + login (USUARIOS_ROLES) en un solo paso */}
            <div className={`rounded-md border p-3 ${estado.activo ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Estado: <span className={estado.activo ? 'text-emerald-700' : 'text-red-700'}>{estado.activo ? 'Activo' : 'Inactivo'}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {!tieneUsuarioRol
                      ? 'Sin cuenta de login asociada'
                      : loginEsAdvisor
                        ? <>Login: {estado.loginActivo === false ? <span className="text-red-700 font-medium">bloqueado</span> : <span className="text-emerald-700 font-medium">habilitado</span>}</>
                        : <>Su login es de rol <strong>{estado.loginRol}</strong>: no se modifica desde aquí (solo la ficha de advisor).</>}
                  </p>
                </div>
                {estado.activo ? (
                  <button type="button" disabled={cambiandoEstado} onClick={() => setConfirmarDesactivar(true)}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                    Desactivar advisor
                  </button>
                ) : (
                  <button type="button" disabled={cambiandoEstado} onClick={() => cambiarEstado(true)}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50">
                    {cambiandoEstado ? 'Activando…' : 'Activar advisor'}
                  </button>
                )}
              </div>
              {loginEsAdvisor && estado.loginActivo != null && estado.loginActivo !== estado.activo && (
                <p className="mt-2 text-[11px] text-amber-800 bg-amber-100 rounded px-2 py-1">
                  La ficha figura {estado.activo ? 'activa' : 'inactiva'} pero el login está {estado.loginActivo ? 'habilitado' : 'bloqueado'}.
                  {estado.activo ? ' "Desactivar advisor" lo deja inactivo en ambos.' : ' "Activar advisor" deja ambos activos.'}
                </p>
              )}
              {loginEsAdvisor && estado.activo && estado.loginActivo === false && (
                <button type="button" disabled={cambiandoEstado} onClick={() => cambiarEstado(true)}
                  className="mt-2 text-[11px] font-medium text-emerald-700 underline hover:no-underline disabled:opacity-50">
                  Habilitar también su login
                </button>
              )}
              {!estado.activo && estado.zoomLiberado && (
                <p className="mt-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 break-all">
                  Sala de Zoom liberada{estado.zoomLiberadoEn ? ` el ${new Date(estado.zoomLiberadoEn).toLocaleDateString('es-CO')}` : ''}: <span className="font-mono">{estado.zoomLiberado}</span>
                </p>
              )}
              {confirmarDesactivar && (
                <div className="mt-3 rounded-md border border-red-300 bg-white p-2.5 space-y-2">
                  <p className="text-xs text-gray-800">
                    Al desactivarlo deja de aparecer como activo en la lista de advisors
                    {loginEsAdvisor ? <> y <strong>se bloquea su login</strong>.</> : ' (su login no cambia).'}
                    {form.zoom.trim()
                      ? <> Se <strong>libera su sala de Zoom</strong> para asignarla a otro advisor (el link queda guardado como referencia).</>
                      : ''}
                    {estado.clasesFuturas > 0
                      ? <> Tiene <strong className="text-red-700">{estado.clasesFuturas} clase(s) futura(s)</strong> asignada(s): <strong>no se mueven</strong>, reasígnelas a otro advisor desde la agenda.</>
                      : ' No tiene clases futuras asignadas.'}
                  </p>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirmarDesactivar(false)} disabled={cambiandoEstado}
                      className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
                    <button type="button" onClick={() => cambiarEstado(false)} disabled={cambiandoEstado}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50">
                      {cambiandoEstado ? 'Desactivando…' : 'Sí, desactivar'}
                    </button>
                  </div>
                </div>
              )}
            </div>

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
