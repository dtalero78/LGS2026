'use client'

import { useState } from 'react'
import type { SuspendDataEntry } from '@/types'

/**
 * Badge "SUSPENDIDA" para mostrar que un contrato está suspendido
 * administrativamente (toggle Activo→Inactivo en Administración o botón
 * "Inactivar" individual del beneficiario en /person/[id]).
 *
 * Sólo se renderiza si `show=true`. Al hacer click abre un modal con el
 * motivo de la última suspensión, fecha, ejecutor y el contador total
 * de suspensiones (suspendcount).
 */

interface SuspendidaBadgeProps {
  show: boolean
  suspenddata?: SuspendDataEntry | null
  suspendcount?: number
}

export default function SuspendidaBadge({ show, suspenddata, suspendcount }: SuspendidaBadgeProps) {
  const [open, setOpen] = useState(false)
  if (!show) return null

  const total = typeof suspendcount === 'number' ? suspendcount : 0
  const tieneDetalle = !!suspenddata

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ver motivo de la suspensión administrativa"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-yellow-400 bg-yellow-200 text-red-700 text-xs font-bold uppercase tracking-wide hover:bg-yellow-300 transition-colors cursor-pointer"
      >
        ⚠️ SUSPENDIDA
      </button>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Suspensión administrativa
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Cerrar"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {tieneDetalle ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Motivo</div>
                  <div className="mt-1 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-900 whitespace-pre-wrap">
                    {suspenddata!.motivo || '(sin motivo)'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</div>
                    <div className="text-sm text-gray-900 mt-1">{formatFecha(suspenddata!.fecha)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Acción</div>
                    <div className="text-sm text-gray-900 mt-1">{suspenddata!.accion}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Realizado por</div>
                  <div className="text-sm text-gray-900 mt-1">
                    {suspenddata!.realizadoPorNombre || suspenddata!.realizadoPor}
                    {suspenddata!.realizadoPorNombre && (
                      <span className="text-gray-500"> &middot; {suspenddata!.realizadoPor}</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Total de inactivaciones registradas para esta persona:{' '}
                    <span className="font-semibold text-gray-700">{total}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                La persona está marcada como suspendida pero no hay registro de motivo
                (probablemente fue inactivada antes de que existiera el campo de auditoría).
                {total > 0 && (
                  <div className="mt-3 text-xs text-gray-500">
                    Total de inactivaciones registradas: <strong>{total}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatFecha(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}
