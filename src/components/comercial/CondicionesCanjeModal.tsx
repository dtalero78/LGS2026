'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

/** Lee PEOPLE.condicionesCanje (array JSONB o string JSON) como lista de textos. */
export function leerCondicionesCanje(raw: unknown): string[] {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(arr) ? arr.map(c => String(c ?? '').trim()).filter(Boolean) : []
  } catch { return [] }
}

interface Props {
  open: boolean
  titularId: string
  subtitulo: string
  condiciones: unknown
  /** Con permiso de canje y (si está aprobado) siendo Super Admin. */
  puedeEditar: boolean
  /** El titular ya firmó: la firma corresponde al texto anterior. */
  firmado: boolean
  onClose: () => void
  onSaved: (condiciones: string[]) => void
}

/**
 * Condiciones de un contrato de CANJE: ver y, con permiso, corregir, agregar o
 * quitar. Guarda con PUT /api/postgres/contracts/[id]/condiciones-canje.
 */
export default function CondicionesCanjeModal({ open, titularId, subtitulo, condiciones, puedeEditar, firmado, onClose, onSaved }: Props) {
  const [lista, setLista] = useState<string[]>([])
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    const actuales = leerCondicionesCanje(condiciones)
    setLista(actuales.length ? actuales : [''])
    setEditando(false)
  }, [open, condiciones])

  if (!open) return null

  const cambiar = (i: number, v: string) => setLista(l => l.map((c, j) => (j === i ? v : c)))
  const agregar = () => setLista(l => [...l, ''])
  const quitar = (i: number) => setLista(l => (l.length > 1 ? l.filter((_, j) => j !== i) : ['']))
  const validas = lista.map(c => c.trim()).filter(Boolean)

  const guardar = async () => {
    if (!validas.length) { toast.error('Escribe al menos una condición.'); return }
    setGuardando(true)
    try {
      const r = await fetch(`/api/postgres/contracts/${titularId}/condiciones-canje`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condiciones: validas }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.success === false) throw new Error(j?.error || `Error ${r.status}`)
      toast.success('Condiciones del canje actualizadas')
      onSaved(leerCondicionesCanje(j.condicionesCanje ?? validas))
      setEditando(false)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudieron guardar las condiciones')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-fuchsia-600 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Condiciones del canje</h2>
            <p className="text-fuchsia-100 text-xs mt-0.5">{subtitulo}</p>
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="text-white/80 hover:text-white">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-3">
          {editando && firmado && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              ⚠️ El titular ya <b>firmó</b> el contrato con las condiciones anteriores. Si las cambias, el contrato firmado ya no coincide: vuelve a enviarlo para su firma.
            </div>
          )}

          {!editando ? (
            validas.length ? (
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-800">
                {validas.map((c, i) => <li key={i}>{c}</li>)}
              </ol>
            ) : <p className="text-sm text-gray-400">Este contrato no tiene condiciones registradas.</p>
          ) : (
            <>
              {lista.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-6 text-right text-sm font-semibold text-gray-500">{i + 1}.</span>
                  <textarea
                    aria-label={`Condición ${i + 1}`}
                    value={c}
                    maxLength={300}
                    rows={2}
                    onChange={e => cambiar(i, e.target.value)}
                    placeholder="Escribe la condición"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                  <button type="button" onClick={() => quitar(i)} title="Quitar condición" className="mt-2 text-gray-400 hover:text-red-600">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={agregar}
                className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-700 hover:text-fuchsia-900">
                <PlusIcon className="h-4 w-4" /> Agregar condición
              </button>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-2">
          {!editando ? (
            <>
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cerrar
              </button>
              {puedeEditar ? (
                <button type="button" onClick={() => setEditando(true)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-fuchsia-600 rounded-md hover:bg-fuchsia-700">
                  Corregir condiciones
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type="button" disabled={guardando}
                onClick={() => { const a = leerCondicionesCanje(condiciones); setLista(a.length ? a : ['']); setEditando(false) }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={guardando || !validas.length}
                className="px-4 py-2 text-sm font-semibold text-white bg-fuchsia-600 rounded-md hover:bg-fuchsia-700 disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar condiciones'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
