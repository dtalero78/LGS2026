'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ServicioPermission } from '@/types/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Row {
  _id: string
  loteId: string
  eventoId: string | null
  fechaEvento: string | null
  horaEvento: string | null
  tipo: string | null
  nivel: string | null
  step: string | null
  tituloEvento: string | null
  advisorId: string | null
  advisorNombre: string | null
  studentId: string | null
  numeroId: string | null
  nombre: string | null
  telefono: string | null
  email: string | null
  gestion: string
  gestionadaPor: string | null
  fechaGestion: string | null
  loteGestionado: boolean
}

const GESTION_OPCIONES = [
  { v: 'SIN_GESTION', l: 'Sin gestión' },
  { v: 'CONTACTADO_REAGENDO', l: 'Contactado / reagendó' },
  { v: 'NO_RESPONDE', l: 'No responde' },
]
const GESTOR_OPCIONES = [
  { v: '', l: '—' },
  { v: 'SERVICIO', l: 'Servicio' },
  { v: 'ACADEMICO', l: 'Académico' },
]

function sesionLabel(r: Row): string {
  const fecha = r.fechaEvento
    ? format(new Date(r.fechaEvento), "EEE d MMM yyyy · HH:mm", { locale: es })
    : '—'
  const nivelStep = [r.nivel, r.step].filter(Boolean).join(' ')
  return [fecha, r.tipo, nivelStep].filter(Boolean).join(' · ')
}

function Content() {
  const [vista, setVista] = useState<'actual' | 'historico'>('actual')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [gestionando, setGestionando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/postgres/cancelaciones-sin-reemplazo?vista=${vista}`)
      const data = await res.json()
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch {
      toast.error('Error cargando cancelaciones')
    } finally {
      setLoading(false)
    }
  }, [vista])

  useEffect(() => { load() }, [load])

  const updateRow = async (id: string, patch: { gestion: string; gestionadaPor: string | null }) => {
    setSavingId(id)
    try {
      const res = await fetch(`/api/postgres/cancelaciones-sin-reemplazo/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error || 'Error al guardar'); return }
      setRows(prev => prev.map(r => (r._id === id ? { ...r, ...j.row } : r)))
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSavingId(null)
    }
  }

  const allGestionadas = vista === 'actual' && rows.length > 0 && rows.every(r => r.gestion !== 'SIN_GESTION')

  const gestionarTodas = async () => {
    if (!allGestionadas || gestionando) return
    if (!confirm(`Marcar como gestionadas ${rows.length} registro(s), pasarlos al histórico y borrar sus clases canceladas del historial de los alumnos? (no afecta el cupo semanal)`)) return
    setGestionando(true)
    try {
      const res = await fetch(`/api/postgres/cancelaciones-sin-reemplazo/gestionar`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error || 'Error'); return }
      toast.success(`${j.gestionadas ?? 0} registro(s) gestionados · ${j.bookingsBorrados ?? 0} clase(s) borrada(s) del historial`)
      load()
    } catch {
      toast.error('Error')
    } finally {
      setGestionando(false)
    }
  }

  // Agrupar por sesión (loteId) para la vista Actual
  const grupos = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of rows) {
      if (!m.has(r.loteId)) m.set(r.loteId, [])
      m.get(r.loteId)!.push(r)
    }
    return [...m.values()]
  }, [rows])

  const gestionBadge = (g: string) => {
    if (g === 'CONTACTADO_REAGENDO') return 'bg-green-100 text-green-800'
    if (g === 'NO_RESPONDE') return 'bg-red-100 text-red-800'
    return 'bg-amber-100 text-amber-800'
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Cancelación sin reemplazo</h1>
        {vista === 'actual' && (
          <button
            type="button"
            onClick={gestionarTodas}
            disabled={!allGestionadas || gestionando}
            title={allGestionadas ? '' : 'Todos los registros deben estar gestionados (ninguno en "Sin gestión")'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gestionando ? 'Procesando…' : 'Gestionada'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {(['actual', 'historico'] as const).map(v => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              vista === v ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {v === 'actual' ? 'Actual' : 'Histórico'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">
          {vista === 'actual' ? 'No hay cancelaciones pendientes de gestión.' : 'No hay cancelaciones en el histórico.'}
        </p>
      ) : vista === 'actual' ? (
        <div className="space-y-6">
          {grupos.map((g, i) => (
            <div key={g[0].loteId || i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-red-50 border-b border-red-200 px-4 py-3">
                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide">Sesión Cancelada sin reemplazo</h3>
                <p className="text-sm text-gray-700 mt-0.5">{sesionLabel(g[0])}</p>
                <p className="text-xs text-gray-500">Advisor: {g[0].advisorNombre || g[0].advisorId || '—'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50">
                      <th className="px-4 py-2">Usuario</th>
                      <th className="px-4 py-2">Teléfono</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Gestión</th>
                      <th className="px-4 py-2">Gestionada por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.map(r => (
                      <tr key={r._id} className={savingId === r._id ? 'opacity-50' : ''}>
                        <td className="px-4 py-2 font-medium text-gray-800">{r.nombre || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{r.telefono || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{r.email || '—'}</td>
                        <td className="px-4 py-2">
                          <select
                            aria-label="Gestión"
                            value={r.gestion}
                            disabled={savingId === r._id}
                            onChange={e => updateRow(r._id, { gestion: e.target.value, gestionadaPor: r.gestionadaPor })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            {GESTION_OPCIONES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            aria-label="Gestionada por"
                            value={r.gestionadaPor || ''}
                            disabled={savingId === r._id}
                            onChange={e => updateRow(r._id, { gestion: r.gestion, gestionadaPor: e.target.value || null })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            {GESTOR_OPCIONES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Histórico: tabla plana con columnas Sesión y Advisor
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50">
                <th className="px-4 py-2">Sesión</th>
                <th className="px-4 py-2">Advisor</th>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-4 py-2">Teléfono</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Gestión</th>
                <th className="px-4 py-2">Gestionada por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r._id}>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{sesionLabel(r)}</td>
                  <td className="px-4 py-2 text-gray-600">{r.advisorNombre || r.advisorId || '—'}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{r.nombre || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{r.telefono || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{r.email || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gestionBadge(r.gestion)}`}>
                      {GESTION_OPCIONES.find(o => o.v === r.gestion)?.l || r.gestion}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {GESTOR_OPCIONES.find(o => o.v === (r.gestionadaPor || ''))?.l || r.gestionadaPor || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CancelacionSinReemplazoPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={ServicioPermission.CANCELACION_SIN_REEMPLAZO_VER} showDefaultMessage>
        <Content />
      </PermissionGuard>
    </DashboardLayout>
  )
}
