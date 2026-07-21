'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { MantenimientoPermission } from '@/types/permissions'
import { exportToExcel } from '@/lib/export-excel'
import { ArrowDownTrayIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

interface UserRow {
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
        <h1 className="text-2xl font-bold text-gray-900">Consulta de Usuarios por Rol</h1>
        <p className="mt-1 text-gray-600">Email, nombre, teléfono, usuario y clave de las cuentas de acceso (USUARIOS_ROLES).</p>
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
                    <td className="px-4 py-2">{u.activo === false ? <span className="text-red-600">No</span> : <span className="text-green-600">Sí</span>}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin usuarios para este filtro.</td></tr>
                )}
              </tbody>
            </table>
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
