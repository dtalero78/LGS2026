'use client'

import { useState } from 'react'
import { api, ApiError } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/usePermissions'
import { StudentPermission } from '@/types/permissions'
import UploadDocButton from './UploadDocButton'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'

/**
 * Tarjeta "Extensión de Vigencia" + modal + historial. La usan la pestaña
 * Contrato del estudiante (/student/[id]) y la ficha de un beneficiario Kids
 * (/person/[id]), que no tiene ficha académica. El servidor (extendByDays)
 * sincroniza con KIDS2026 cuando el beneficiario es Kids.
 */
interface ExtensionVigenciaProps {
  /** `_id` de PEOPLE del beneficiario. */
  peopleId: string
  nombre: string
  finalContrato?: string | Date | null
  vigencia?: number | string | null
  extensionCount?: number | null
  extensionHistory?: any[] | null
}

export default function ExtensionVigencia({
  peopleId,
  nombre,
  finalContrato,
  vigencia,
  extensionCount,
  extensionHistory,
}: ExtensionVigenciaProps) {
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [nuevaFechaFinal, setNuevaFechaFinal] = useState('')
  const [motivoExtension, setMotivoExtension] = useState('')
  const [isExtendingVigencia, setIsExtendingVigencia] = useState(false)
  const [showExtensionHistory, setShowExtensionHistory] = useState(false)

  const { hasPermission, isLoading: permLoading } = usePermissions()
  // Tener el permiso EXTENDER_VIGENCIA permite extender aunque el contrato esté Finalizado
  const canExtender = hasPermission(StudentPermission.EXTENDER_VIGENCIA)

  const handleExtendVigencia = async () => {
    if (!nuevaFechaFinal) {
      alert('⚠️ Por favor seleccione una nueva fecha de vigencia')
      return
    }
    if (!motivoExtension.trim()) {
      alert('⚠️ El motivo de la extensión es obligatorio')
      return
    }
    const fechaActual = finalContrato ? new Date(finalContrato) : new Date()
    const nuevaFecha = new Date(nuevaFechaFinal)
    if (nuevaFecha <= fechaActual) {
      alert('⚠️ La nueva fecha debe ser posterior a la fecha actual de vigencia')
      return
    }
    const diasExtendidos = Math.ceil((nuevaFecha.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24))
    const confirmed = window.confirm(
      `⚠️ ATENCIÓN: Extensión de Vigencia\n\n` +
      `Estudiante: ${nombre}\n` +
      `Vigencia actual: ${fechaActual.toLocaleDateString('es-ES')}\n` +
      `Nueva vigencia: ${nuevaFecha.toLocaleDateString('es-ES')}\n` +
      `Días extendidos: ${diasExtendidos}\n` +
      `Motivo: ${motivoExtension}`
    )
    if (!confirmed) return
    setIsExtendingVigencia(true)
    try {
      const data = await api.post(`/api/postgres/students/${peopleId}/extend`, {
        diasExtension: diasExtendidos,
        motivo: motivoExtension,
      })
      alert(
        `✅ Extensión aplicada\n` +
        `Días extendidos: ${data.data?.data?.diasExtendidos || diasExtendidos}\n` +
        `Nueva vigencia: ${nuevaFecha.toLocaleDateString('es-ES')}` +
        (data?.message ? `\n\n${data.message}` : '')
      )
      setShowExtensionModal(false)
      setMotivoExtension('')
      window.location.reload()
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Error al comunicarse con el servidor'
      alert(`❌ ${msg}`)
    } finally {
      setIsExtendingVigencia(false)
    }
  }

  // ── vigencia badge color — vigencia puede llegar como string o number desde la API
  const vigDays = (vigencia !== null && vigencia !== undefined)
    ? Math.round(Number(vigencia))
    : null
  const vigColor = vigDays === null || isNaN(vigDays as number) ? 'text-gray-600'
    : vigDays < 30  ? 'text-red-600'
    : vigDays < 90  ? 'text-orange-600'
    : 'text-green-600'

  return (
    <>
      <div className="flex flex-col bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CalendarDaysIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Extensión de Vigencia</h4>
              <p className="text-xs text-gray-500">Cambiar la fecha final del estudiante</p>
            </div>
          </div>
          {!!extensionCount && extensionCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-full">
                {extensionCount} ext.
              </span>
              <button type="button" onClick={() => setShowExtensionHistory(true)}
                className="text-xs text-green-600 hover:text-green-800 underline font-medium">
                Ver historial
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-medium mb-1">Vigencia actual</p>
            <p className="font-semibold text-gray-900 text-xs leading-snug">
              {finalContrato
                ? new Date(finalContrato).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                : '—'}
            </p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-medium mb-1">Días restantes</p>
            <p className={`font-bold ${vigColor}`}>
              {vigDays !== null && !isNaN(vigDays) ? `${vigDays} días` : '—'}
            </p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-medium mb-1">Extensiones</p>
            <p className="font-semibold text-gray-900">{extensionCount ?? 0} veces</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExtensionModal(true)}
          disabled={!canExtender || permLoading}
          className="mt-auto w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <CalendarDaysIcon className="w-4 h-4" />
          Extender Vigencia del Estudiante
        </button>
        {!permLoading && !canExtender && (
          <p className="text-xs text-gray-400 text-center mt-1">Sin permiso para extender vigencia</p>
        )}
      </div>

      {/* ── Modal Extender Vigencia ─────────────────────────────────────── */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Extender Vigencia</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              Vigencia actual:{' '}
              <strong>
                {finalContrato
                  ? new Date(finalContrato).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
                  : 'No disponible'}
              </strong>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha final *</label>
              <input type="date" value={nuevaFechaFinal} onChange={e => setNuevaFechaFinal(e.target.value)}
                title="Nueva fecha final de vigencia"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-green-500 focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
              <textarea value={motivoExtension} onChange={e => setMotivoExtension(e.target.value)}
                rows={2} placeholder="Motivo de la extensión"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-green-500 focus:border-green-500" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <UploadDocButton
                peopleId={peopleId}
                size="sm"
                label="Agregar Doc."
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowExtensionModal(false); setMotivoExtension('') }}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="button" onClick={handleExtendVigencia} disabled={isExtendingVigencia}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {isExtendingVigencia ? 'Extendiendo...' : 'Confirmar extensión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Historial de Extensiones ─────────────────────────────── */}
      {showExtensionHistory && extensionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Historial de Extensiones</h3>
              <button type="button" onClick={() => setShowExtensionHistory(false)} className="text-gray-400 hover:text-gray-600 text-xl" title="Cerrar">×</button>
            </div>
            {extensionHistory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Sin extensiones registradas</p>
            ) : (
              <div className="space-y-3">
                {extensionHistory.map((ext: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                    <p className="font-semibold text-gray-800">Extensión #{ext.numero || i + 1}</p>
                    <p className="text-gray-600">Fecha: {ext.fechaEjecucion ? new Date(ext.fechaEjecucion).toLocaleDateString('es-CO') : '—'}</p>
                    <p className="text-gray-600">Días: +{ext.diasExtendidos}</p>
                    <p className="text-gray-600">Anterior: {ext.vigenciaAnterior ? new Date(ext.vigenciaAnterior).toLocaleDateString('es-CO') : '—'}</p>
                    <p className="text-gray-600">Nueva: {ext.vigenciaNueva ? new Date(ext.vigenciaNueva).toLocaleDateString('es-CO') : '—'}</p>
                    {ext.ejecutadoPor && <p className="text-gray-600">Por: {ext.ejecutadoPor}</p>}
                    {ext.motivo && <p className="text-gray-500 italic">{ext.motivo}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
