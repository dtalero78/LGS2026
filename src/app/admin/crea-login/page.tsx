'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { MantenimientoPermission } from '@/types/permissions'
import { MagnifyingGlassIcon, KeyIcon, CheckCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline'

interface Persona {
  peopleId: string
  numeroId: string
  nombre: string
  tipoUsuario: string | null
  email: string | null
  celular: string | null
  contrato: string | null
  nivel: string | null
  step: string | null
  estado: string | null
  estadoInactivo: boolean
  tieneLogin: boolean
  loginActivo: boolean | null
  loginEmail: string | null
  tieneAcademica: boolean
}

interface Creado { email: string; password: string; nombre: string; numeroId: string; contrato: string | null; academicaCreada?: boolean }

export default function CreaLoginPage() {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState<Persona[]>([])
  const [buscado, setBuscado] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [creado, setCreado] = useState<Creado | null>(null)

  const buscar = async () => {
    if (q.trim().length < 2) { toast.error('Escribe al menos 2 caracteres'); return }
    setLoading(true); setBuscado(true); setOpenId(null); setCreado(null)
    try {
      const r = await fetch(`/api/postgres/mantenimiento/crea-login?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok || d?.success === false) throw new Error(d?.error || 'Error en la búsqueda')
      setResultados((d.data ?? d).resultados || [])
    } catch (e: any) {
      toast.error(e?.message || 'Error en la búsqueda'); setResultados([])
    } finally { setLoading(false) }
  }

  const abrirForm = (p: Persona) => {
    setOpenId(p.peopleId)
    setEmail(p.email || '')
    setPassword(p.numeroId || '')  // convención: contraseña = documento
    setCreado(null)
  }

  const crear = async (p: Persona) => {
    setSaving(true)
    try {
      const r = await fetch('/api/postgres/mantenimiento/crea-login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peopleId: p.peopleId, email: email.trim(), password: password.trim() }),
      })
      const d = await r.json()
      if (!r.ok || d?.success === false) throw new Error(d?.error || 'No se pudo crear el login')
      const data = (d.data ?? d)
      setCreado({ email: data.email, password: data.password, nombre: data.nombre, numeroId: data.numeroId, contrato: data.contrato, academicaCreada: data.academicaCreada === true })
      toast.success(data.academicaCreada ? 'Login + registro académico creados' : 'Login creado/activado')
      setOpenId(null)
      buscar() // refresca el estado de la fila
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo crear el login')
    } finally { setSaving(false) }
  }

  const badgeLogin = (p: Persona) => {
    if (p.tieneLogin && p.loginActivo) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Con acceso</span>
    if (p.tieneLogin) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Login inactivo</span>
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Sin login</span>
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.CREAR_LOGIN} showDefaultMessage>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <KeyIcon className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Crea login</h1>
          </div>
          <p className="text-gray-500 mb-6">
            Genera el registro en <strong>USUARIOS_ROLES</strong> y deja el acceso habilitado para un usuario que no puede ingresar al panel.
            Busca por <strong>documento, nombre o contrato</strong>. La contraseña por defecto es el documento del usuario.
          </p>

          {/* Buscador */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              placeholder="Documento, nombre o número de contrato…"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              type="button" onClick={buscar} disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          {/* Credenciales creadas */}
          {creado && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                <CheckCircleIcon className="h-5 w-5" /> Acceso habilitado — {creado.nombre}
              </div>
              <div className="text-sm text-green-900 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <div><span className="text-green-700">Usuario:</span> <strong>{creado.email}</strong></div>
                <div><span className="text-green-700">Contraseña:</span> <strong>{creado.password}</strong></div>
                <div><span className="text-green-700">Documento:</span> {creado.numeroId}</div>
                <div><span className="text-green-700">Contrato:</span> {creado.contrato || '—'}</div>
              </div>
              {creado.academicaCreada && (
                <p className="mt-2 text-xs text-green-800">✔ También se creó su <strong>registro académico</strong> (nivel WELCOME), necesario para el panel del estudiante.</p>
              )}
              <p className="mt-2 text-xs text-green-700">Sugerencia: pídele al usuario que cambie la contraseña al ingresar.</p>
            </div>
          )}

          {/* Resultados */}
          {buscado && !loading && resultados.length === 0 && (
            <p className="text-gray-400 italic">No se encontraron personas para «{q}».</p>
          )}

          <div className="space-y-3">
            {resultados.map(p => (
              <div key={p.peopleId} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{p.nombre || '(sin nombre)'}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{p.tipoUsuario || '—'}</span>
                      {badgeLogin(p)}
                      {!p.tieneAcademica && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Sin registro académico</span>}
                      {p.estadoInactivo && <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">Inactivo</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      Doc {p.numeroId} · Contrato {p.contrato || '—'} · {p.nivel || '—'} {p.step || ''} · {p.email || '(sin email)'}
                    </div>
                  </div>
                  <div>
                    {p.tieneLogin && p.loginActivo ? (
                      <button
                        type="button" onClick={() => abrirForm(p)}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Restablecer / reactivar
                      </button>
                    ) : (
                      <button
                        type="button" onClick={() => abrirForm(p)}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"
                      >
                        <LockClosedIcon className="h-4 w-4" />
                        {p.tieneLogin ? 'Activar login' : 'Crear login'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Form inline */}
                {openId === p.peopleId && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 rounded-b-xl">
                    {!p.tieneAcademica && (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        ⚠️ Este usuario <strong>no tiene registro académico</strong>. Al confirmar se creará el <strong>login</strong> y además un <strong>registro académico</strong> (nivel WELCOME) para que pueda usar el panel del estudiante.
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-sm">
                        <span className="block text-gray-600 mb-1">Usuario (email)</span>
                        <input
                          type="text" value={email} onChange={e => setEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="usuario@correo.com"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="block text-gray-600 mb-1">Contraseña</span>
                        <input
                          type="text" value={password} onChange={e => setPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Documento del usuario"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button" onClick={() => crear(p)} disabled={saving}
                        className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                      >
                        {saving ? 'Guardando…' : 'Confirmar y habilitar acceso'}
                      </button>
                      <button
                        type="button" onClick={() => setOpenId(null)}
                        className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
