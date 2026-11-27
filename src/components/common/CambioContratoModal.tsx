'use client'

/**
 * Aviso tras cambiar las personas de un contrato (agregar / eliminar / reemplazar
 * beneficiario, reemplazar titular). El servidor ya está generando el PDF nuevo
 * (lib/regenerar-pdf-cambio); aquí se muestra el resumen y se aconseja enviar el
 * contrato nuevo al titular. Si se reemplazó al titular, la firma quedó anulada y
 * hay que solicitar una firma nueva.
 */

import { DocumentArrowUpIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'

export interface CambioContrato {
  titulo: string
  resumen: string
  contrato?: string | null
  titularId?: string | null
  /** Se reemplazó al titular: firma anulada, hay que solicitarla de nuevo. */
  firmaAnulada?: boolean
}

export default function CambioContratoModal({ cambio, onClose }: { cambio: CambioContrato; onClose: () => void }) {
  const urlContrato = cambio.titularId ? `/dashboard/comercial/contrato/${cambio.titularId}` : null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">{cambio.titulo}</h3>
            {cambio.contrato && <p className="text-xs text-gray-500">Contrato {cambio.contrato}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Resumen del cambio</p>
            <p className="rounded-md bg-gray-50 p-2 text-gray-800">{cambio.resumen}</p>
          </div>
          <p className="flex items-start gap-2 text-gray-700">
            <DocumentArrowUpIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
            Se está generando el <b>PDF nuevo del contrato</b> con los datos actuales y reemplazará al anterior en el Drive (tarda unos segundos; queda registrado en el Seguimiento).
          </p>
          {cambio.firmaAnulada ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>Se reemplazó al titular: <b>la firma anterior se anuló</b>. Debe <b>solicitar una firma nueva</b> y enviarle el contrato nuevo al titular desde la pantalla del contrato.</span>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              Se aconseja <b>enviar el contrato nuevo al titular</b> para que tenga la versión con los beneficiarios actuales.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Cerrar</button>
          {urlContrato && (
            <a href={urlContrato} target="_blank" rel="noopener noreferrer" onClick={onClose}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${cambio.firmaAnulada ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {cambio.firmaAnulada ? 'Ir al contrato para solicitar firma' : 'Ir al contrato para enviarlo'}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
