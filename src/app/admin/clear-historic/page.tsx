'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface ClearOption {
  id: string
  label: string
  description: string
  warning: string
  endpoint: string
  confirmText: string
}

const CLEAR_OPTIONS: ClearOption[] = [
  {
    id: 'bookings_cancelled',
    label: 'Bookings Cancelados',
    description: 'Elimina todos los registros de ACADEMICA_BOOKINGS donde cancelo = true.',
    warning: 'Esta acción es irreversible. Los bookings cancelados se eliminarán permanentemente.',
    endpoint: '/api/admin/clear-historic?type=bookings_cancelled',
    confirmText: 'ELIMINAR CANCELADOS',
  },
  {
    id: 'otp_expired',
    label: 'OTP Expirados',
    description: 'Limpia el almacén en memoria de OTP expirados (se limpian automáticamente, pero fuerza una limpieza inmediata).',
    warning: 'Los OTP activos no se verán afectados.',
    endpoint: '/api/admin/clear-historic?type=otp_expired',
    confirmText: 'LIMPIAR OTP',
  },
]

export default function ClearHistoricPage() {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const selected = CLEAR_OPTIONS.find(o => o.id === confirming)

  async function handleExecute() {
    if (!selected || confirmInput !== selected.confirmText) return
    setLoading(selected.id)
    try {
      const res = await fetch(selected.endpoint, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar')
      toast.success(data.message || 'Operación completada')
      setConfirming(null)
      setConfirmInput('')
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  function handleCancel() {
    setConfirming(null)
    setConfirmInput('')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            title="Volver al Dashboard"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrashIcon className="h-7 w-7 text-red-500" />
              Clear Historic
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Limpieza de datos históricos. Solo SUPER_ADMIN puede ejecutar estas operaciones.
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Las operaciones de esta página son <strong>irreversibles</strong>. Asegúrese de tener
            un respaldo antes de proceder.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {CLEAR_OPTIONS.map(option => (
            <div key={option.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{option.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    {option.warning}
                  </p>
                </div>
                <button
                  onClick={() => { setConfirming(option.id); setConfirmInput('') }}
                  disabled={!!loading}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TrashIcon className="h-4 w-4" />
                  Ejecutar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Confirmation modal */}
        {confirming && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                <h2 className="text-lg font-bold text-gray-900">Confirmar operación</h2>
              </div>
              <p className="text-sm text-gray-600">
                Está a punto de ejecutar: <strong>{selected.label}</strong>
              </p>
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {selected.warning}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Escriba <span className="font-mono font-bold text-red-600">{selected.confirmText}</span> para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                  placeholder={selected.confirmText}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExecute}
                  disabled={confirmInput !== selected.confirmText || !!loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === selected.id ? 'Ejecutando...' : 'Confirmar y ejecutar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
