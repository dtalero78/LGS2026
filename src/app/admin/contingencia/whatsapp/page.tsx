'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { MantenimientoPermission } from '@/types/permissions'
import toast from 'react-hot-toast'

interface Canal {
  id: 'A' | 'B'
  numero: string
  channelId: string
  nombre: string
  activo: boolean
  conectado: boolean
  estado: string
  numeroDetectado: string | null
}

function Content() {
  const [canales, setCanales] = useState<Canal[]>([])
  const [activo, setActivo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/contingencia/whatsapp')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error || 'Error cargando estado'); return }
      setCanales(Array.isArray(j.canales) ? j.canales : [])
      setActivo(j.activo || '')
    } catch {
      toast.error('Error cargando estado')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const activar = async (canal: 'A' | 'B') => {
    if (canal === activo || saving) return
    const c = canales.find(x => x.id === canal)
    if (!confirm(`¿Enrutar TODO el WhatsApp por el canal ${canal} (${c?.numero})?\n\nEl cambio es efectivo en ≤1 minuto, sin deploy.`)) return
    setSaving(canal)
    try {
      const r = await fetch('/api/admin/contingencia/whatsapp', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ canal }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error || 'Error al cambiar de canal'); return }
      toast.success(`Canal ${canal} activado — todo el WhatsApp sale ahora por ${c?.numero}. Efecto en ≤1 min.`)
      await load()
    } catch {
      toast.error('Error al cambiar de canal')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
      <p className="text-sm text-gray-500 mb-6">
        Elige por cuál número sale <b>todo</b> el WhatsApp de la plataforma (OTP de firma, PDF del contrato,
        bienvenida, reagendar, etc.). Si un teléfono se cae (estado <b>&quot;QR&quot;</b>), activa el otro. El cambio
        es efectivo en <b>≤1 minuto</b>, sin necesidad de desplegar.
      </p>

      {loading ? (
        <p className="text-gray-500">Cargando estado en vivo…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {canales.map((c) => {
            const esActivo = c.id === activo
            return (
              <div
                key={c.id}
                className={`rounded-xl border-2 p-5 ${esActivo ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Canal {c.id}</span>
                  {esActivo && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">ACTIVO</span>
                  )}
                </div>
                <div className="mt-1 text-lg font-bold text-gray-900">{c.numero}</div>
                <div className="text-sm text-gray-500">{c.nombre}</div>

                <div className="mt-3 flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.conectado ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className={`text-sm font-semibold ${c.conectado ? 'text-emerald-700' : 'text-red-600'}`}>
                    {c.conectado ? 'Conectado (AUTH)' : `Caído (${c.estado})`}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Canal Whapi: {c.channelId}</div>

                <button
                  onClick={() => activar(c.id)}
                  disabled={esActivo || saving !== null}
                  className={`mt-4 w-full px-3 py-2 rounded-md text-sm font-semibold ${
                    esActivo
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'
                  }`}
                >
                  {esActivo ? 'En uso' : saving === c.id ? 'Activando…' : 'Activar este canal'}
                </button>

                {!c.conectado && !esActivo && (
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠ Este canal está caído; actívalo solo cuando vuelva a &quot;AUTH&quot;.
                  </p>
                )}
                {!c.conectado && esActivo && (
                  <p className="mt-2 text-xs text-red-600 font-semibold">
                    ⚠ El canal activo está caído — cambia al otro para que el WhatsApp funcione.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        El estado se consulta en vivo a Whapi al abrir la página y con &quot;Refrescar&quot;. Esta pantalla nunca
        muestra los tokens.
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
