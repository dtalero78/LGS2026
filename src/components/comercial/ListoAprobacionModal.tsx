'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon, CheckBadgeIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'

/**
 * "Dejar listo para aprobación" (pantalla del contrato): el ejecutivo confirma los
 * cuatro puntos y el contrato queda marcado (PEOPLE.listoAprobacion del titular).
 * POST /api/postgres/contracts/[id]/listo-aprobacion.
 */
const PUNTOS = [
  { k: 'firmado', label: 'El titular ya firmó el contrato.' },
  { k: 'pdf', label: 'Ya se generó y envió el PDF del contrato.' },
  { k: 'documentos', label: 'Ya se subieron los documentos y el recibo de pago de la inscripción.' },
  { k: 'informacion', label: 'Ya se verificó la información digitada en el contrato.' },
] as const

export default function ListoAprobacionModal({ titularId, contrato, firmado, onClose, onDone }: {
  titularId: string
  contrato: string
  /** Firma real (consentimiento registrado). Sin firma no se puede dejar listo. */
  firmado: boolean
  onClose: () => void
  onDone: (r: { listoAprobacion: boolean; listoAprobacionPor: string; listoAprobacionEn: string }) => void
}) {
  const [marcas, setMarcas] = useState<Record<string, boolean>>({})
  const [enviando, setEnviando] = useState(false)
  const todas = PUNTOS.every((p) => marcas[p.k])

  const confirmar = async () => {
    if (!todas || !firmado) return
    setEnviando(true)
    try {
      const r = await api.post(`/api/postgres/contracts/${titularId}/listo-aprobacion`, marcas)
      toast.success(`Contrato ${contrato} listo para aprobación`)
      onDone(r)
    } catch (e) {
      handleApiError(e, 'No se pudo dejar listo el contrato')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-sky-600 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Dejar listo para aprobación</h2>
            <p className="text-sky-100 text-xs mt-0.5">Contrato {contrato}</p>
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="text-white/80 hover:text-white">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 text-sm">
          {!firmado ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              El contrato <b>aún no está firmado</b>. Envíelo para firma (o ratifíquelo) antes de dejarlo listo para aprobación.
            </div>
          ) : (
            <>
              <p className="text-gray-600">Confirme cada punto. El contrato quedará en el Libro de Producción como <b>"Firma, Documentos, pendiente aprobación"</b>.</p>
              {PUNTOS.map((p) => (
                <label key={p.k} className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!marcas[p.k]} onChange={(e) => setMarcas((m) => ({ ...m, [p.k]: e.target.checked }))}
                    className="mt-0.5 accent-sky-600" />
                  <span className="text-gray-800">{p.label}</span>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            {firmado ? 'Cancelar' : 'Cerrar'}
          </button>
          {firmado && (
            <button type="button" onClick={confirmar} disabled={!todas || enviando}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50">
              <CheckBadgeIcon className="h-4 w-4" />
              {enviando ? 'Guardando…' : 'Dejar listo para aprobación'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
