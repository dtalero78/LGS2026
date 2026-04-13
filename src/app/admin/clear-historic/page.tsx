'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

/* ─────────────────────────────── types ─────────────────────────────── */

interface LookupResult {
  found: boolean
  inPeople: boolean
  inAcademica: boolean
  message?: string
  nombreCompleto?: string
  numeroId?: string
  academicaIds?: string[]
  counts?: {
    bookings: number
    complementaria: number
    stepOverrides: number
  }
}

type StudentStep =
  | 'idle'
  | 'searching'
  | 'not_found'
  | 'found'
  | 'confirm1'
  | 'confirm2'
  | 'deleting'
  | 'done'

interface DeletedCounts {
  bookings: number
  complementaria: number
  stepOverrides: number
}

/* ─────────────────────────────── component ─────────────────────────── */

export default function ClearHistoricPage() {
  const [numeroId, setNumeroId] = useState('')
  const [step, setStep] = useState<StudentStep>('idle')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [deletedCounts, setDeletedCounts] = useState<DeletedCounts | null>(null)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function resetStudent() {
    setStep('idle')
    setNumeroId('')
    setLookupResult(null)
    setDeletedCounts(null)
    setProgress(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSearch() {
    const id = numeroId.trim()
    if (!id) return
    setStep('searching')
    try {
      const res = await fetch(`/api/admin/clear-historic/lookup?numeroId=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.details || data.error || 'Error al buscar')
      const result: LookupResult = data.data ?? data
      setLookupResult(result)
      setStep(result.found ? 'found' : 'not_found')
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado')
      setStep('idle')
    }
  }

  async function handleDelete() {
    if (!lookupResult?.academicaIds) return
    setStep('deleting')
    setProgress(10)

    const tick = (target: number) =>
      new Promise<void>(resolve => {
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= target) { clearInterval(interval); resolve(); return prev }
            return prev + 1
          })
        }, 30)
      })

    try {
      await tick(30)
      const res = await fetch('/api/admin/clear-historic/student', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicaIds: lookupResult.academicaIds,
          numeroId: lookupResult.numeroId,
        }),
      })
      await tick(80)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      await tick(100)
      setDeletedCounts(data.deleted ?? data.data?.deleted)
      setStep('done')
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado')
      setStep('found')
      setProgress(0)
    }
  }

  const totalCount =
    (lookupResult?.counts?.bookings ?? 0) +
    (lookupResult?.counts?.complementaria ?? 0) +
    (lookupResult?.counts?.stepOverrides ?? 0)

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
              Limpieza de historial académico de estudiantes. Solo SUPER_ADMIN.
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

        {/* Student Historic Cleaner */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrashIcon className="h-5 w-5 text-red-500" />
              Limpiar Historial de Estudiante
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Elimina el historial académico de un estudiante (Bookings, Actividades Complementarias
              y Step Overrides). Los registros WELCOME se conservan.
            </p>
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={numeroId}
              onChange={e => setNumeroId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && step === 'idle' && handleSearch()}
              disabled={step !== 'idle'}
              placeholder="Número de documento (Ej: 1234567890)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={step === 'idle' ? handleSearch : resetStudent}
              disabled={step === 'searching' || step === 'deleting'}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-700 hover:bg-gray-800 text-white"
            >
              {step === 'idle' || step === 'not_found' ? (
                <><MagnifyingGlassIcon className="h-4 w-4" /> Buscar</>
              ) : step === 'searching' ? (
                <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Buscando...</>
              ) : (
                <><XMarkIcon className="h-4 w-4" /> Nueva búsqueda</>
              )}
            </button>
          </div>

          {/* Not found */}
          {step === 'not_found' && lookupResult && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Estudiante no encontrado</p>
                <p className="text-sm text-yellow-700 mt-0.5">{lookupResult.message}</p>
                <ul className="text-xs text-yellow-600 mt-2 space-y-0.5">
                  <li>PEOPLE: {lookupResult.inPeople ? '✅ Encontrado' : '❌ No encontrado'}</li>
                  <li>ACADEMICA: {lookupResult.inAcademica ? '✅ Encontrado' : '❌ No encontrado'}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Found — counts */}
          {(step === 'found' || step === 'confirm1' || step === 'confirm2') && lookupResult?.found && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                <p className="text-sm font-semibold text-blue-800">
                  {lookupResult.nombreCompleto}
                  <span className="font-normal text-blue-600 ml-2">— ID: {lookupResult.numeroId}</span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                  <p className="text-2xl font-bold text-gray-800">{lookupResult.counts?.bookings ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Bookings</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                  <p className="text-2xl font-bold text-gray-800">{lookupResult.counts?.complementaria ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Complementarias</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                  <p className="text-2xl font-bold text-gray-800">{lookupResult.counts?.stepOverrides ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Step Overrides</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">* Registros con nivel/tipo WELCOME se conservarán.</p>
              {step === 'found' && (
                <button
                  type="button"
                  onClick={() => setStep('confirm1')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                  Eliminar historial
                </button>
              )}
            </div>
          )}

          {/* Deleting — progress */}
          {step === 'deleting' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <p className="text-sm font-medium text-gray-700">Eliminando registros...</p>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-right">{progress}%</p>
            </div>
          )}

          {/* Done — summary */}
          {step === 'done' && deletedCounts && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                <p className="text-sm font-semibold text-green-800">Historial eliminado correctamente</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                  <p className="text-2xl font-bold text-gray-800">{deletedCounts.bookings}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Bookings</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                  <p className="text-2xl font-bold text-gray-800">{deletedCounts.complementaria}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Complementarias</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                  <p className="text-2xl font-bold text-gray-800">{deletedCounts.stepOverrides}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Step Overrides</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetStudent}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Limpiar otro estudiante
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation modal — paso 1 */}
      {step === 'confirm1' && lookupResult?.found && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
              <h2 className="text-lg font-bold text-gray-900">¿Está seguro?</h2>
            </div>
            <p className="text-sm text-gray-600">
              Está a punto de borrar el historial académico de:
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-gray-900">{lookupResult.nombreCompleto}</p>
              <p className="text-gray-500">N° Documento: {lookupResult.numeroId}</p>
            </div>
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              Se eliminarán <strong>{totalCount}</strong> registros en total.
              Esta acción es <strong>irreversible</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setStep('found')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                No, cancelar
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm2')}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Sí, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal — paso 2 final */}
      {step === 'confirm2' && lookupResult?.found && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
              <h2 className="text-lg font-bold text-gray-900">Confirmación final</h2>
            </div>
            <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">
              Se dispone a <strong>borrar el registro académico</strong> del usuario:{' '}
              <strong>{lookupResult.nombreCompleto}</strong> (ID: {lookupResult.numeroId}).
              Esta operación no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setStep('found')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800"
              >
                Confirmar y borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
