'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { MantenimientoPermission } from '@/types/permissions'
import toast from 'react-hot-toast'

interface CanalEstado {
  id: 'A' | 'B'
  numero: string
  channelId: string
  nombre: string
  conectado: boolean
  estado: string
  numeroDetectado: string | null
}
interface TipoRow { key: string; label: string; descripcion: string; canal: 'A' | 'B' }

function Content() {
  const [canales, setCanales] = useState<CanalEstado[]>([])
  const [tipos, setTipos] = useState<TipoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/contingencia/whatsapp')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error || 'Error cargando estado'); return }
      setCanales(Array.isArray(j.canales) ? j.canales : [])
      setTipos(Array.isArray(j.tipos) ? j.tipos : [])
    } catch {
      toast.error('Error cargando estado')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const numeroDe = (id: 'A' | 'B') => canales.find(c => c.id === id)?.numero || id
  const conectadoDe = (id: 'A' | 'B') => canales.find(c => c.id === id)?.conectado

  const cambiar = async (tipo: string, canal: 'A' | 'B') => {
    if (saving) return
    const row = tipos.find(t => t.key === tipo)
    if (!row || row.canal === canal) return
    setSaving(tipo)
    const prev = tipos
    setTipos(p => p.map(t => (t.key === tipo ? { ...t, canal } : t))) // optimista
    try {
      const r = await fetch('/api/admin/contingencia/whatsapp', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo, canal }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error || 'Error al cambiar de canal'); setTipos(prev); return }
      toast.success(`"${row.label}" ahora sale por ${numeroDe(canal)}. Efecto en ≤1 min.`)
    } catch {
      toast.error('Error al cambiar de canal'); setTipos(prev)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Canales de WhatsApp</h1>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          ↻ Refrescar
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Elige por cuál número sale <b>cada tipo de mensaje</b>. Si un teléfono se cae (estado <b>&quot;QR&quot;</b> 🔴),
        mové sus mensajes al otro canal. El cambio es efectivo en <b>≤1 minuto</b>, sin necesidad de desplegar.
      </p>

      {/* Estado en vivo de los 2 canales */}
      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        {canales.map(c => (
          <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Canal {c.id}</div>
              <div className="text-base font-bold text-gray-900">{c.numero}</div>
              <div className="text-xs text-gray-500">{c.nombre}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.conectado ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className={`text-sm font-semibold ${c.conectado ? 'text-emerald-700' : 'text-red-600'}`}>
                {c.conectado ? 'AUTH' : c.estado}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Canal por tipo de mensaje */}
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Tipo de mensaje</th>
                <th className="text-left px-4 py-2 font-semibold">Sale por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tipos.map(t => (
                <tr key={t.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-400">{t.descripcion}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                      {(['A', 'B'] as const).map(id => {
                        const activo = t.canal === id
                        const caido = conectadoDe(id) === false
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={saving === t.key}
                            onClick={() => cambiar(t.key, id)}
                            title={numeroDe(id)}
                            className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${
                              activo ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                            } ${id === 'B' ? 'border-l border-gray-300' : ''}`}
                          >
                            {id} · {numeroDe(id).replace('+56 9 ', '')}{caido ? ' 🔴' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-5 text-xs text-gray-400">
        El estado se consulta en vivo a Whapi al abrir la página y con &quot;Refrescar&quot;. Esta pantalla nunca muestra los tokens.
      </p>
    </div>
  )
}

export default function Page() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.CONTINGENCIA_WHATSAPP} showDefaultMessage>
        <Content />
      </PermissionGuard>
    </DashboardLayout>
  )
}
