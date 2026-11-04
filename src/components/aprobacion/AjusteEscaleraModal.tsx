'use client'

/**
 * Libro de Producción › detalle › "Ajuste Escalera": corrige la escalera comercial del
 * titular (Ej. Training, Full Executive, Jefe de grupo, Gerente, Gerente división, Sales
 * Manager, Filial y Origen matrícula). Sugiere los nombres ya usados en el país; la filial
 * se elige del catálogo del país. Motivo obligatorio; el cambio queda en el Seguimiento.
 * API: GET/PATCH /api/postgres/libro-produccion/[titularId]/escalera.
 */

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'

const CAMPOS: [string, string][] = [
  ['asesorCreadorContrato', 'Ej. Training'], ['fullExecutive', 'Full Executive'], ['jefeGrupo', 'Jefe de grupo'],
  ['gerente', 'Gerente'], ['gerenteDivision', 'Gerente división'], ['salesManager', 'Sales Manager'],
  ['filial', 'Filial'], ['origenMatricula', 'Origen matrícula'],
]

interface Opciones { pais: string | null; actual: Record<string, string>; sugerencias: Record<string, string[]>; filiales: string[] }

export default function AjusteEscaleraModal({ titularId, contrato, onClose, onGuardado }: {
  titularId: string; contrato: string | null; onClose: () => void
  onGuardado: (comercial: Record<string, string | null>) => void
}) {
  const [op, setOp] = useState<Opciones | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api.get<Opciones>(`/api/postgres/libro-produccion/${titularId}/escalera`)
      .then(d => { setOp(d); setForm({ ...d.actual }) })
      .catch(e => { handleApiError(e, 'No se pudo cargar la escalera'); onClose() })
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titularId])

  const cambiados = op ? CAMPOS.filter(([k]) => (form[k] || '').trim() !== (op.actual[k] || '').trim()) : []

  const guardar = async () => {
    setGuardando(true)
    try {
      const body: Record<string, string> = { motivo }
      for (const [k] of cambiados) body[k] = form[k] || ''
      const res = await fetch(`/api/postgres/libro-produccion/${titularId}/escalera`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Escalera ajustada')
      onGuardado(j.comercial)
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ajuste Escalera</h2>
            <p className="text-xs text-gray-500">Contrato {contrato || '—'}{op?.pais ? ` · ${op.pais}` : ''} · escalera comercial del día de la matrícula</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        {!op ? (
          <p className="p-10 text-center text-sm italic text-gray-400">Cargando…</p>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPOS.map(([k, l]) => {
                const cambio = (form[k] || '').trim() !== (op.actual[k] || '').trim()
                const cls = `w-full rounded-md border px-2.5 py-1.5 text-sm ${cambio ? 'border-amber-400 bg-amber-50/50' : 'border-gray-300'}`
                return (
                  <label key={k} className="text-xs text-gray-600">
                    <span className="mb-0.5 block">{l}{cambio && <span className="ml-1 text-amber-700">· antes: {op.actual[k] || '—'}</span>}</span>
                    {k === 'filial' ? (
                      <select value={form.filial || ''} onChange={e => setForm(f => ({ ...f, filial: e.target.value }))} className={`${cls} bg-white`}>
                        <option value="">— Sin filial —</option>
                        {/* La filial actual se muestra aunque ya no esté activa en el catálogo. */}
                        {op.actual.filial && !op.filiales.includes(op.actual.filial) && <option value={op.actual.filial}>{op.actual.filial} (fuera del catálogo)</option>}
                        {op.filiales.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    ) : (
                      <>
                        <input value={form[k] || ''} list={`esc-${k}`} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className={cls} />
                        <datalist id={`esc-${k}`}>{(op.sugerencias[k] || []).map(v => <option key={v} value={v} />)}</datalist>
                      </>
                    )}
                  </label>
                )
              })}
            </div>
            <label className="block text-xs text-gray-600">
              <span className="mb-0.5 block">Motivo del ajuste * <span className="text-gray-400">(mínimo 10 caracteres; queda en el Seguimiento)</span></span>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm" placeholder="Ej.: el enlace del CRM no trajo la escalera; confirmado con el jefe de grupo" />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{cambiados.length ? `${cambiados.length} campo(s) modificado(s)` : 'Sin cambios'}</span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} disabled={guardando} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="button" onClick={guardar} disabled={guardando || !cambiados.length || motivo.trim().length < 10}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
