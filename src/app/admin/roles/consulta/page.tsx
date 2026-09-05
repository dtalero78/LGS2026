'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { MantenimientoPermission } from '@/types/permissions'
import { exportToExcel } from '@/lib/export-excel'
import { ArrowDownTrayIcon, EyeIcon, EyeSlashIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'

const PLATAFORMAS = ['Chile', 'Colombia', 'Ecuador', 'Perú', 'Internacional']

interface UserRow {
  _id: string
  email: string
  nombre: string | null
  apellido: string | null
  celular: string | null
  numberid: string | null
  password: string | null
  rol: string
  plataforma: string | null
  activo: boolean | null
}

function ConsultaUserRol() {
  const [roles, setRoles] = useState<{ rol: string; total: number }[]>([])
  const [rol, setRol] = useState<string>('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showClaves, setShowClaves] = useState(false)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Modal Editar
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', apellido: '', celular: '', numberid: '', plataforma: '' })
  const [editMotivo, setEditMotivo] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Modal Eliminar
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [deleteMotivo, setDeleteMotivo] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Cargar roles (para el dropdown) al montar.
  useEffect(() => {
    fetch('/api/postgres/users/consulta')
      .then(r => r.json())
      .then(d => { if (d?.success) setRoles(d.roles || []) })
      .catch(() => {})
  }, [])

  // Debounce búsqueda.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Cargar usuarios cuando cambia rol o búsqueda.
  useEffect(() => {
    if (!rol) { setUsers([]); return }
    setLoading(true); setError('')
    const qs = new URLSearchParams({ rol, ...(debouncedSearch ? { search: debouncedSearch } : {}) })
    fetch(`/api/postgres/users/consulta?${qs}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.success) throw new Error(d?.error || 'Error')
        setUsers(d.users || [])
      })
      .catch(e => setError(e?.message || 'No se pudo cargar'))
      .finally(() => setLoading(false))
  }, [rol, debouncedSearch])

  const nombreCompleto = (u: UserRow) => [u.nombre, u.apellido].filter(Boolean).join(' ').trim()

  // Activar / desactivar la cuenta de acceso (USUARIOS_ROLES.activo). Desactivar
  // BLOQUEA el login de esa cuenta. Pide confirmación y actualiza la fila en vivo.
  const toggleActivo = async (u: UserRow) => {
    const isActive = u.activo !== false
    const next = !isActive
    const msg = next
      ? `¿ACTIVAR la cuenta ${u.email}?`
      : `¿DESACTIVAR la cuenta ${u.email}?\n\nEsto BLOQUEA su login Y le cambia la clave por una nueva.`
    if (!confirm(msg)) return
    setSavingId(u._id)
    try {
      const res = await fetch('/api/postgres/users/consulta', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u._id, activo: next }),
      })
      const d = await res.json()
      if (!res.ok || !d?.success) throw new Error(d?.error || `Error ${res.status}`)
      setUsers(prev => prev.map(x => (x._id === u._id ? { ...x, activo: d.activo, password: d.password ?? x.password } : x)))
      if (!next && d.password) {
        setShowClaves(true)
        alert(`Cuenta desactivada. Nueva clave: ${d.password}`)
      }
    } catch (e: any) {
      alert(e?.message || 'No se pudo cambiar el estado')
    } finally {
      setSavingId(null)
    }
  }

  // ── Editar campos (rellenar vacíos / modificar) ──
  const openEdit = (u: UserRow) => {
    setEditUser(u)
    setEditForm({
      nombre: u.nombre || '',
      apellido: u.apellido || '',
      celular: u.celular || '',
      numberid: u.numberid || '',
      plataforma: u.plataforma || '',
    })
    setEditMotivo('')
  }
  const saveEdit = async () => {
    if (!editUser) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/postgres/users/consulta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editUser._id,
          nombre: editForm.nombre,
          apellido: editForm.apellido,
          celular: editForm.celular,
          numberid: editForm.numberid,
          plataforma: editForm.plataforma,
          motivo: editMotivo,
        }),
      })
      const d = await res.json()
      if (!res.ok || !d?.success) throw new Error(d?.error || `Error ${res.status}`)
      if (d.user) setUsers(prev => prev.map(x => (x._id === editUser._id ? { ...x, ...d.user } : x)))
      setEditUser(null)
    } catch (e: any) {
      alert(e?.message || 'No se pudo guardar')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Eliminar cuenta (con motivo obligatorio + auditoría) ──
  const confirmDelete = async () => {
    if (!deleteUser) return
    if (!deleteMotivo.trim()) { alert('El motivo es obligatorio.'); return }
    setIsDeleting(true)
    try {
      const res = await fetch('/api/postgres/users/consulta', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteUser._id, motivo: deleteMotivo.trim() }),
      })
      const d = await res.json()
      if (!res.ok || !d?.success) throw new Error(d?.error || `Error ${res.status}`)
      setUsers(prev => prev.filter(x => x._id !== deleteUser._id))
      setDeleteUser(null); setDeleteMotivo(''); setDeleteConfirm(false)
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar')
    } finally {
      setIsDeleting(false)
    }
  }

  const exportar = () => {
    exportToExcel<UserRow>(
      users,
      [
        { header: 'Email', accessor: u => u.email },
        { header: 'Nombre', accessor: u => nombreCompleto(u) },
        { header: 'Teléfono', accessor: u => u.celular || '' },
        { header: 'Usuario', accessor: u => u.numberid || '' },
        { header: 'Clave', accessor: u => u.password || '' },
        { header: 'Rol', accessor: u => u.rol },
        { header: 'Plataforma', accessor: u => u.plataforma || '' },
        { header: 'Activo', accessor: u => (u.activo === false ? 'No' : 'Sí') },
      ],
      `usuarios-${rol === '__ALL__' ? 'todos' : rol}`,
    )
  }

  const total = users.length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión Usuarios — Consulta por Rol</h1>
        <p className="mt-1 text-gray-600">Email, nombre, teléfono, usuario y clave de las cuentas de acceso (USUARIOS_ROLES). Edita o elimina cada cuenta desde la columna Acciones.</p>
        <a href="/admin/roles/create" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800">
          ➕ Crear una cuenta de acceso (estudiante, administrativo, advisor o comercial)
        </a>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Seleccionar rol…</option>
            <option value="__ALL__">— Todos los roles —</option>
            {roles.map(r => (
              <option key={r.rol} value={r.rol}>{r.rol} ({r.total})</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar (nombre, email, usuario, teléfono)</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Escribe para filtrar…"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <button
          onClick={() => setShowClaves(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          title={showClaves ? 'Ocultar claves' : 'Mostrar claves'}
        >
          {showClaves ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          {showClaves ? 'Ocultar claves' : 'Mostrar claves'}
        </button>
        <button
          onClick={exportar}
          disabled={users.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="h-4 w-4" /> Exportar CSV
        </button>
      </div>

      {/* Resultados */}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {!rol ? (
        <div className="text-center text-gray-500 py-16 bg-white border border-gray-200 rounded-lg">
          Selecciona un rol para ver los usuarios.
        </div>
      ) : loading ? (
        <div className="text-center text-gray-500 py-16">Cargando…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
            {total} usuario(s){total >= 5000 ? ' (mostrando los primeros 5000)' : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Teléfono</th>
                  <th className="px-4 py-2">Usuario</th>
                  <th className="px-4 py-2">Clave</th>
                  <th className="px-4 py-2">Rol</th>
                  <th className="px-4 py-2">Plataforma</th>
                  <th className="px-4 py-2">Activo</th>
                  <th className="px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u, idx) => (
                  <tr key={u.email + idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{u.email}</td>
                    <td className="px-4 py-2">{nombreCompleto(u) || '—'}</td>
                    <td className="px-4 py-2">{u.celular || '—'}</td>
                    <td className="px-4 py-2">{u.numberid || '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{showClaves ? (u.password || '—') : '••••••••'}</td>
                    <td className="px-4 py-2"><span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs">{u.rol}</span></td>
                    <td className="px-4 py-2">{u.plataforma || '—'}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => toggleActivo(u)}
                        disabled={savingId === u._id}
                        title={u.activo === false ? 'Clic para ACTIVAR la cuenta' : 'Clic para DESACTIVAR (bloquea login y cambia la clave)'}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition disabled:opacity-50 ${
                          u.activo === false
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        }`}
                      >
                        {savingId === u._id ? '…' : (u.activo === false ? 'No' : 'Sí')}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          title="Editar campos"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeleteUser(u); setDeleteMotivo(''); setDeleteConfirm(false) }}
                          title="Eliminar cuenta"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          <TrashIcon className="h-3.5 w-3.5" /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Sin usuarios para este filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Editar ── */}
      {editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Editar cuenta de acceso</h2>
              <p className="text-blue-100 text-xs mt-0.5 break-all">{editUser.email} · {editUser.rol}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                ⚠️ Este cambio solo afecta la <b>cuenta de acceso</b> (USUARIOS_ROLES) y queda registrado en la auditoría.
                Completar <b>Teléfono</b> y <b>Usuario</b> habilita el reset de contraseña por WhatsApp.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={editForm.nombre}
                    onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input type="text" value={editForm.apellido}
                    onChange={e => setEditForm(f => ({ ...f, apellido: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono <span className="text-xs text-gray-400">(solo números, con indicativo)</span></label>
                  <input type="tel" value={editForm.celular}
                    onChange={e => setEditForm(f => ({ ...f, celular: e.target.value.replace(/\D/g, '') }))}
                    placeholder="Ej: 56912345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario <span className="text-xs text-gray-400">(N° identificación)</span></label>
                  <input type="text" value={editForm.numberid}
                    onChange={e => setEditForm(f => ({ ...f, numberid: e.target.value.toUpperCase().replace(/[.\s]/g, '') }))}
                    placeholder="Ej: 12345678K"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                  <select value={editForm.plataforma}
                    onChange={e => setEditForm(f => ({ ...f, plataforma: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Sin plataforma —</option>
                    {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
                    {editForm.plataforma && !PLATAFORMAS.includes(editForm.plataforma) && (
                      <option value={editForm.plataforma}>{editForm.plataforma}</option>
                    )}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo <span className="text-xs text-gray-400">(opcional, queda en la auditoría)</span></label>
                  <input type="text" value={editMotivo}
                    onChange={e => setEditMotivo(e.target.value)}
                    placeholder="Ej: completar datos de contacto"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setEditUser(null)} disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={saveEdit} disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {isSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Eliminar ── */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-red-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Eliminar cuenta de acceso</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <b>🔴 Acción irreversible.</b> Se eliminará la cuenta de acceso de{' '}
                <b className="break-all">{deleteUser.email}</b> ({deleteUser.rol}). El usuario no podrá volver a iniciar sesión.
                Queda un respaldo en la auditoría (recuperable manualmente).
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo <span className="text-red-500">*</span></label>
                <textarea value={deleteMotivo} onChange={e => setDeleteMotivo(e.target.value)} rows={2}
                  placeholder="Explica por qué se elimina esta cuenta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={deleteConfirm} onChange={e => setDeleteConfirm(e.target.checked)} className="mt-0.5" />
                Confirmo que quiero eliminar esta cuenta de acceso.
              </label>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteUser(null)} disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmDelete} disabled={isDeleting || !deleteConfirm || !deleteMotivo.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {isDeleting ? 'Eliminando…' : 'Eliminar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConsultaUserRolPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.CREAR_ROL} showDefaultMessage>
        <ConsultaUserRol />
      </PermissionGuard>
    </DashboardLayout>
  )
}
