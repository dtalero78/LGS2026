'use client'

import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { MantenimientoPermission } from '@/types/permissions'
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  UserGroupIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

/**
 * "Crea UserRol" — página con 4 opciones de creación de cuentas:
 *   1. Estudiante   — desde ACADEMICA existente → login USUARIOS_ROLES (flujo original)
 *   2. Administrativo — rol de ROL_PERMISOS + login USUARIOS_ROLES (clave auto)
 *   3. Advisor      — ADVISORS + login USUARIOS_ROLES (reusa advisors/create)
 *   4. Comercial    — EQUIPO_COMERCIAL + login USUARIOS_ROLES (clave auto)
 *
 * Permiso: MANTENIMIENTO.USUARIOS.CREAR_ROL (SUPER_ADMIN/ADMIN bypass).
 */

const PLATAFORMAS = ['Chile', 'Colombia', 'Ecuador', 'Perú', 'Internacional']
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Mode = null | 'estudiante' | 'administrativo' | 'advisor' | 'comercial'

// Generador de clave temporal (cliente) para el flujo de Advisor, que usa el
// endpoint público advisors/create. Administrativo/Comercial la generan server-side.
function genClientPassword(len = 10): string {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  for (let i = 0; i < len; i++) out += A[arr[i] % A.length]
  return out
}

// ─────────────────────────── UI helpers ───────────────────────────

function CredentialCard({ email, password, extra }: { email: string; password: string; extra?: React.ReactNode }) {
  return (
    <div className="bg-white border border-emerald-200 rounded-lg p-4 text-sm space-y-2">
      <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Correo</span><span className="col-span-2 font-medium font-mono text-gray-900">{email}</span></div>
      {extra}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-100 items-center">
        <span className="text-gray-500">Clave temporal</span>
        <span className="col-span-2 flex items-center gap-2">
          <code className="font-mono font-bold text-gray-900 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">{password}</code>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(password); toast.success('Clave copiada') }} title="Copiar clave" className="text-gray-400 hover:text-gray-600">
            <ClipboardDocumentIcon className="h-4 w-4" />
          </button>
        </span>
      </div>
      <p className="text-xs text-amber-700 pt-1">⚠️ Esta clave se muestra una sola vez. Cópiala y entrégala al usuario; podrá cambiarla luego.</p>
    </div>
  )
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-600">*</span>}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// ─────────────────────────── Selector ───────────────────────────

function Selector({ onPick }: { onPick: (m: Mode) => void }) {
  const cards: { mode: Mode; title: string; desc: string; icon: any; iconWrap: string; iconColor: string }[] = [
    { mode: 'estudiante', title: 'Estudiante', desc: 'Desde un registro existente en ACADEMICA. Crea el login (rol ESTUDIANTE).', icon: AcademicCapIcon, iconWrap: 'bg-indigo-100', iconColor: 'text-indigo-600' },
    { mode: 'administrativo', title: 'Administrativo', desc: 'Selecciona un rol de la matriz de permisos y captura los datos. Clave auto-generada.', icon: BriefcaseIcon, iconWrap: 'bg-blue-100', iconColor: 'text-blue-600' },
    { mode: 'advisor', title: 'Advisor', desc: 'Crea el advisor en ADVISORS + login. Requiere foto de perfil.', icon: UserPlusIcon, iconWrap: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { mode: 'comercial', title: 'Comercial', desc: 'Registra en Equipo Comercial + login (rol COMERCIAL). Captura filial.', icon: UserGroupIcon, iconWrap: 'bg-purple-100', iconColor: 'text-purple-600' },
  ]
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map(c => (
          <button key={c.mode} type="button" onClick={() => onPick(c.mode)}
            className="text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition">
            <div className={`inline-flex items-center justify-center w-11 h-11 ${c.iconWrap} rounded-full mb-3`}>
              <c.icon className={`h-6 w-6 ${c.iconColor}`} />
            </div>
            <h3 className="text-base font-bold text-gray-900">{c.title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{c.desc}</p>
          </button>
        ))}
      </div>
      <a href="/admin/filiales" className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800">
        <BuildingOffice2Icon className="h-4 w-4" /> Gestionar filiales (para el alta de comerciales)
      </a>
    </div>
  )
}

// ─────────────────────────── 1) Estudiante (flujo original) ───────────────────────────

interface AcademicaPreview {
  _id: string; numeroId: string; nombre: string; apellido: string
  email: string | null; celular: string | null; contrato: string | null
  plataforma: string | null; tipoUsuario: string | null; nivel: string | null; step: string | null
  estadoInactivo: boolean | null
}
interface PreviewResponse {
  academica: AcademicaPreview; canCreate: boolean
  issues: { code: string; message: string }[]
  existingUser: { _id: string; nombre: string; rol: string; activo: boolean | null } | null
  passwordFromAcademica: boolean
}

function EstudianteForm() {
  const [numeroId, setNumeroId] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ user: any; passwordSource: 'academica' | 'admin'; academicaId: string } | null>(null)

  const handleSearch = async () => {
    const id = numeroId.trim()
    if (!id) return
    setLoading(true); setError(null); setPreview(null); setPassword(''); setCreated(null)
    try {
      const res = await fetch(`/api/admin/users/create-from-academica?numeroId=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      setPreview(data as PreviewResponse)
    } catch (e: any) { setError(e?.message || 'Error al buscar') }
    finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!preview?.canCreate) return
    setCreating(true); setError(null)
    try {
      const body: Record<string, string> = { numeroId: preview.academica.numeroId }
      if (!preview.passwordFromAcademica) {
        if (!password || password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres')
        body.password = password
      }
      const res = await fetch('/api/admin/users/create-from-academica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      toast.success(`Cuenta creada para ${data.user.nombre}`)
      setCreated({ user: data.user, passwordSource: data.passwordSource, academicaId: data.academicaId })
    } catch (e: any) { setError(e?.message || 'Error al crear cuenta') }
    finally { setCreating(false) }
  }

  if (created) {
    return (
      <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="h-7 w-7 text-emerald-600 flex-shrink-0" />
          <div><h2 className="text-lg font-bold text-emerald-900">Cuenta de estudiante creada</h2>
            <p className="text-sm text-emerald-800 mt-0.5">Ya puede iniciar sesión con su email y contraseña.</p></div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-lg p-4 text-sm space-y-2">
          <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Email</span><span className="col-span-2 font-medium font-mono text-gray-900">{created.user.email}</span></div>
          <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Nombre</span><span className="col-span-2 font-medium text-gray-900">{created.user.nombre}{created.user.apellido ? ` ${created.user.apellido}` : ''}</span></div>
          <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Contrato</span><span className="col-span-2 font-medium text-gray-900">{created.user.contrato || '—'}</span></div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-100"><span className="text-gray-500">Fuente clave</span><span className="col-span-2 font-medium text-gray-900">{created.passwordSource === 'academica' ? 'ACADEMICA.clave existente' : 'Ingresada por el admin'}</span></div>
        </div>
        <div className="flex gap-2">
          <a href={`/student/${created.academicaId}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">Ver perfil del estudiante →</a>
          <button type="button" onClick={() => { setCreated(null); setPreview(null); setNumeroId(''); setPassword('') }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">Crear otra</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <label htmlFor="numero-id" className="block text-sm font-medium text-gray-700 mb-2">Número de Documento del estudiante</label>
        <div className="flex gap-2">
          <input id="numero-id" type="text" value={numeroId}
            onChange={e => setNumeroId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Ej: 0703697813 o 18201897-K"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={loading || creating} />
          <button type="button" onClick={handleSearch} disabled={!numeroId.trim() || loading || creating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold">
            <MagnifyingGlassIcon className="h-4 w-4" />{loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Se busca en <code className="bg-gray-100 px-1 rounded">ACADEMICA.numeroId</code>. El rol será <strong>ESTUDIANTE</strong>.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"><XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-red-800">{error}</p></div>}

      {preview && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Encontrado en ACADEMICA</h2>
            {preview.academica.tipoUsuario && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{preview.academica.tipoUsuario}</span>}
            {preview.academica.estadoInactivo === true && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">INACTIVO</span>}
          </div>
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="text-gray-500">Nombre:</span> <span className="font-medium text-gray-900">{preview.academica.nombre || <em className="text-red-600">vacío</em>}</span></div>
            <div><span className="text-gray-500">Apellido:</span> <span className="font-medium text-gray-900">{preview.academica.apellido || '—'}</span></div>
            <div className="col-span-2"><span className="text-gray-500">Email:</span> <span className="font-medium font-mono text-gray-900">{preview.academica.email || <em className="text-red-600">vacío</em>}</span></div>
            <div><span className="text-gray-500">Plataforma:</span> <span className="font-medium text-gray-900">{preview.academica.plataforma || '—'}</span></div>
            <div><span className="text-gray-500">Contrato:</span> <span className="font-medium text-gray-900">{preview.academica.contrato || '—'}</span></div>
          </div>
          <div className="space-y-2">
            {preview.issues.map(issue => (
              <div key={issue.code} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3"><XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-red-800">{issue.message}</p></div>
            ))}
            {preview.canCreate && (preview.passwordFromAcademica
              ? <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3"><CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0" /><p className="text-sm text-blue-800">Se usará la contraseña existente en <code>ACADEMICA.clave</code>.</p></div>
              : <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3"><ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-amber-800"><code>ACADEMICA.clave</code> está vacía. Ingresa una contraseña temporal.</p></div>
            )}
          </div>
          {preview.canCreate && !preview.passwordFromAcademica && (
            <Field label="Contraseña temporal" required>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 4 caracteres" className={`${inputCls} font-mono pr-10`} disabled={creating} />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}</button>
              </div>
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={handleCreate} disabled={!preview.canCreate || creating || (!preview.passwordFromAcademica && password.length < 4)}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{creating ? 'Creando…' : '✓ Crear cuenta'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── 2) Administrativo ───────────────────────────

function AdministrativoForm() {
  const [roles, setRoles] = useState<{ rol: string; descripcion: string }[]>([])
  const [form, setForm] = useState({ rol: '', nombre: '', apellido: '', email: '', celular: '', numberid: '', plataforma: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ user: any; password: string } | null>(null)

  useEffect(() => {
    fetch('/api/postgres/roles?activo=true').then(r => r.json()).then(d => {
      if (d?.success && Array.isArray(d.roles)) {
        const excl = new Set(['ESTUDIANTE', 'ADVISOR', 'COMERCIAL'])
        setRoles(d.roles.filter((r: any) => !excl.has(String(r.rol).toUpperCase())).map((r: any) => ({ rol: r.rol, descripcion: r.descripcion || '' })))
      }
    }).catch(() => {})
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.rol && form.nombre.trim() && emailRe.test(form.email.trim())

  const submit = async () => {
    setError(null)
    if (!valid) { setError('Completa rol, nombre y un correo válido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users/create-administrativo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      toast.success('Cuenta administrativa creada')
      setDone({ user: data.user, password: data.generatedPassword })
    } catch (e: any) { setError(e?.message || 'Error al crear') }
    finally { setSaving(false) }
  }

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-3"><CheckCircleIcon className="h-7 w-7 text-emerald-600 flex-shrink-0" /><div><h2 className="text-lg font-bold text-emerald-900">Cuenta administrativa creada</h2><p className="text-sm text-emerald-800 mt-0.5">Rol {done.user.rol}. Ya puede iniciar sesión.</p></div></div>
      <CredentialCard email={done.user.email} password={done.password} extra={<>
        <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Nombre</span><span className="col-span-2 font-medium text-gray-900">{done.user.nombre}{done.user.apellido ? ` ${done.user.apellido}` : ''}</span></div>
        <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Rol</span><span className="col-span-2 font-medium text-gray-900">{done.user.rol}</span></div>
      </>} />
      <button type="button" onClick={() => { setDone(null); setForm({ rol: '', nombre: '', apellido: '', email: '', celular: '', numberid: '', plataforma: '' }) }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">Crear otra</button>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Rol" required>
          <select value={form.rol} onChange={e => set('rol', e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">— Seleccione —</option>
            {roles.map(r => <option key={r.rol} value={r.rol}>{r.rol}{r.descripcion ? ` — ${r.descripcion}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Plataforma"><select value={form.plataforma} onChange={e => set('plataforma', e.target.value)} className={`${inputCls} bg-white`}><option value="">— Ninguna —</option>{PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
        <Field label="Nombre" required><input value={form.nombre} onChange={e => set('nombre', e.target.value)} className={inputCls} /></Field>
        <Field label="Apellido"><input value={form.apellido} onChange={e => set('apellido', e.target.value)} className={inputCls} /></Field>
        <Field label="Correo" required><input value={form.email} onChange={e => set('email', e.target.value.replace(/\s/g, ''))} className={`${inputCls} font-mono`} placeholder="correo@dominio.com" /></Field>
        <Field label="Celular"><input value={form.celular} onChange={e => set('celular', e.target.value.replace(/\D/g, ''))} className={inputCls} /></Field>
        <Field label="Número de identificación"><input value={form.numberid} onChange={e => set('numberid', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} className={`${inputCls} font-mono`} /></Field>
      </div>
      <p className="text-xs text-gray-400">La clave se genera automáticamente y se muestra al crear.</p>
      <div className="flex justify-end"><button type="button" onClick={submit} disabled={!valid || saving} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Creando…' : '✓ Crear administrativo'}</button></div>
    </div>
  )
}

// ─────────────────────────── 3) Advisor ───────────────────────────

function AdvisorForm() {
  const [form, setForm] = useState({ primerNombre: '', primerApellido: '', email: '', numeroId: '', zoom: '', telefono: '', pais: '', domicilio: '', fechaNacimiento: '' })
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ email: string; password: string; nombre: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.primerNombre.trim() && form.primerApellido.trim() && emailRe.test(form.email.trim()) && form.numeroId.trim() && !!fotoFile

  const onFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('La foto debe ser una imagen'); return }
    setFotoFile(file); setFotoPreview(URL.createObjectURL(file)); setError(null)
  }

  const uploadFoto = async (): Promise<string | null> => {
    if (!fotoFile) return null
    const ext = fotoFile.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const tempKey = `fotosAdvisors/new_${Date.now()}.${ext}`
    const presignRes = await fetch('/api/postgres/advisors/photo-presign-public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tempKey, contentType: fotoFile.type }) })
    const presignData = await presignRes.json()
    if (!presignData.success) throw new Error(presignData.error || 'Error al generar URL de foto')
    const up = await fetch(presignData.presignedUrl, { method: 'PUT', headers: { 'Content-Type': fotoFile.type }, body: fotoFile })
    if (!up.ok) throw new Error('Error al subir la foto')
    return presignData.key
  }

  const submit = async () => {
    setError(null)
    if (!valid) { setError('Completa nombre, apellido, correo válido, identificación y foto'); return }
    setSaving(true)
    try {
      const fotoKey = await uploadFoto()
      const password = genClientPassword()
      const res = await fetch('/api/postgres/advisors/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, fotoKey, clave: password }) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      toast.success('Advisor creado')
      setDone({ email: form.email.trim().toLowerCase(), password, nombre: `${form.primerNombre} ${form.primerApellido}`.trim() })
    } catch (e: any) { setError(e?.message || 'Error al crear advisor') }
    finally { setSaving(false) }
  }

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-3"><CheckCircleIcon className="h-7 w-7 text-emerald-600 flex-shrink-0" /><div><h2 className="text-lg font-bold text-emerald-900">Advisor creado</h2><p className="text-sm text-emerald-800 mt-0.5">Creado en ADVISORS + login (rol ADVISOR).</p></div></div>
      <CredentialCard email={done.email} password={done.password} extra={<div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Nombre</span><span className="col-span-2 font-medium text-gray-900">{done.nombre}</span></div>} />
      <button type="button" onClick={() => { setDone(null); setForm({ primerNombre: '', primerApellido: '', email: '', numeroId: '', zoom: '', telefono: '', pais: '', domicilio: '', fechaNacimiento: '' }); setFotoFile(null); setFotoPreview(null) }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">Crear otro</button>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}
      <div className="flex items-center gap-4">
        <div className={`w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center bg-gray-50 ${fotoPreview ? 'border-emerald-300' : 'border-gray-200'}`}>
          {fotoPreview ? <img src={fotoPreview} alt="foto" className="w-full h-full object-cover" /> : <UserPlusIcon className="h-8 w-8 text-gray-300" />}
        </div>
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">Subir foto *</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFoto} />
          <p className="text-xs text-gray-400 mt-1">Obligatoria (JPG, PNG, WEBP).</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Primer nombre" required><input value={form.primerNombre} onChange={e => set('primerNombre', e.target.value)} className={inputCls} /></Field>
        <Field label="Primer apellido" required><input value={form.primerApellido} onChange={e => set('primerApellido', e.target.value)} className={inputCls} /></Field>
        <Field label="Correo" required><input value={form.email} onChange={e => set('email', e.target.value.replace(/\s/g, ''))} className={`${inputCls} font-mono`} placeholder="correo@dominio.com" /></Field>
        <Field label="Número de identificación" required><input value={form.numeroId} onChange={e => set('numeroId', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} className={`${inputCls} font-mono`} /></Field>
        <Field label="Link de Zoom"><input value={form.zoom} onChange={e => set('zoom', e.target.value)} className={inputCls} /></Field>
        <Field label="Teléfono"><input value={form.telefono} onChange={e => set('telefono', e.target.value.replace(/\D/g, ''))} className={inputCls} /></Field>
        <Field label="País"><input value={form.pais} onChange={e => set('pais', e.target.value)} className={inputCls} /></Field>
        <Field label="Fecha de nacimiento"><input type="date" value={form.fechaNacimiento} onChange={e => set('fechaNacimiento', e.target.value)} className={inputCls} /></Field>
        <div className="sm:col-span-2"><Field label="Domicilio"><input value={form.domicilio} onChange={e => set('domicilio', e.target.value)} className={inputCls} /></Field></div>
      </div>
      <p className="text-xs text-gray-400">La clave se genera automáticamente y se muestra al crear.</p>
      <div className="flex justify-end"><button type="button" onClick={submit} disabled={!valid || saving} className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Creando…' : '✓ Crear advisor'}</button></div>
    </div>
  )
}

// ─────────────────────────── 4) Comercial ───────────────────────────

function ComercialForm() {
  const [form, setForm] = useState({ nombre: '', correo: '', plataforma: '', filial: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ comercial: any; password: string } | null>(null)
  const [filiales, setFiliales] = useState<{ _id: string; nombre: string }[]>([])

  // Filiales del catálogo según la plataforma elegida (dropdown del campo filial).
  useEffect(() => {
    if (!form.plataforma) { setFiliales([]); return }
    let cancel = false
    fetch(`/api/admin/filiales?plataforma=${encodeURIComponent(form.plataforma)}`)
      .then(r => r.json())
      .then(d => { if (!cancel && d?.success) setFiliales(d.filiales || []) })
      .catch(() => { if (!cancel) setFiliales([]) })
    return () => { cancel = true }
  }, [form.plataforma])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  // Al cambiar la plataforma se limpia la filial seleccionada (pertenece a otra plataforma).
  const setPlataforma = (v: string) => setForm(f => ({ ...f, plataforma: v, filial: '' }))
  const valid = form.nombre.trim() && emailRe.test(form.correo.trim())

  const submit = async () => {
    setError(null)
    if (!valid) { setError('Completa nombre y un correo válido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users/create-comercial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      toast.success('Comercial creado')
      setDone({ comercial: data.comercial, password: data.generatedPassword })
    } catch (e: any) { setError(e?.message || 'Error al crear comercial') }
    finally { setSaving(false) }
  }

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-3"><CheckCircleIcon className="h-7 w-7 text-emerald-600 flex-shrink-0" /><div><h2 className="text-lg font-bold text-emerald-900">Comercial creado</h2><p className="text-sm text-emerald-800 mt-0.5">Registrado en Equipo Comercial + login (rol COMERCIAL).</p></div></div>
      <CredentialCard email={done.comercial.correo} password={done.password} extra={<>
        <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Nombre</span><span className="col-span-2 font-medium text-gray-900">{done.comercial.nombre}</span></div>
        <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Plataforma</span><span className="col-span-2 font-medium text-gray-900">{done.comercial.plataforma || '—'}</span></div>
        <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Filial</span><span className="col-span-2 font-medium text-gray-900">{done.comercial.filial || '—'}</span></div>
      </>} />
      <button type="button" onClick={() => { setDone(null); setForm({ nombre: '', correo: '', plataforma: '', filial: '' }) }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">Crear otro</button>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nombre" required><input value={form.nombre} onChange={e => set('nombre', e.target.value)} className={inputCls} /></Field>
        <Field label="Correo" required><input value={form.correo} onChange={e => set('correo', e.target.value.replace(/\s/g, ''))} className={`${inputCls} font-mono`} placeholder="correo@dominio.com" /></Field>
        <Field label="Plataforma"><select value={form.plataforma} onChange={e => setPlataforma(e.target.value)} className={`${inputCls} bg-white`}><option value="">— Ninguna —</option>{PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
        <Field label="Filial" hint={form.plataforma && filiales.length === 0 ? 'No hay filiales para esta plataforma. Agrégalas en "Gestionar filiales".' : undefined}>
          <select value={form.filial} onChange={e => set('filial', e.target.value)} disabled={!form.plataforma} className={`${inputCls} bg-white disabled:bg-gray-50 disabled:cursor-not-allowed`}>
            <option value="">{form.plataforma ? '— Selecciona —' : '— Elige plataforma primero —'}</option>
            {filiales.map(f => <option key={f._id} value={f.nombre}>{f.nombre}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-xs text-gray-400">Crea la fila en Equipo Comercial y el login (rol COMERCIAL). La clave se genera automáticamente.</p>
      <div className="flex justify-end"><button type="button" onClick={submit} disabled={!valid || saving} className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">{saving ? 'Creando…' : '✓ Crear comercial'}</button></div>
    </div>
  )
}

// ─────────────────────────── Página ───────────────────────────

const MODE_TITLE: Record<string, string> = { estudiante: 'Estudiante', administrativo: 'Administrativo', advisor: 'Advisor', comercial: 'Comercial' }

export default function CrearUserRolPage() {
  const [mode, setMode] = useState<Mode>(null)

  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.CREAR_ROL}>
        <div className="max-w-3xl mx-auto py-8 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full flex-shrink-0"><UserPlusIcon className="h-7 w-7 text-indigo-600" /></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Crea UserRol</h1>
                <p className="text-sm text-gray-500 mt-0.5">Crea cuentas de acceso: estudiante, administrativo, advisor o comercial.</p>
              </div>
            </div>
          </div>

          {!mode && <Selector onPick={setMode} />}

          {mode && (
            <>
              <button type="button" onClick={() => setMode(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
                <ArrowLeftIcon className="h-4 w-4" /> Volver · <span className="text-gray-900 font-semibold">{MODE_TITLE[mode]}</span>
              </button>
              {mode === 'estudiante' && <EstudianteForm />}
              {mode === 'administrativo' && <AdministrativoForm />}
              {mode === 'advisor' && <AdvisorForm />}
              {mode === 'comercial' && <ComercialForm />}
            </>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
