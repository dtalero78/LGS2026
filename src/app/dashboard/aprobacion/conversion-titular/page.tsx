'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AprobacionPermission } from '@/types/permissions'
import { ArrowsRightLeftIcon, UserIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface TitularInfo {
  _id: string
  nombre: string
  numeroId: string
  celular: string | null
  email: string | null
  contrato: string
  plataforma: string | null
}

export default function ConversionTitularPage() {
  const router = useRouter()
  const [contrato, setContrato] = useState('')
  const [numeroId, setNumeroId] = useState('')
  const [titular, setTitular] = useState<TitularInfo | null>(null)
  const [yaConvertido, setYaConvertido] = useState(false)
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ beneficiarioNombre: string; titularNombre: string; titularId: string } | null>(null)

  const buscar = async () => {
    setError(null); setTitular(null); setYaConvertido(false); setDone(null)
    if (!contrato.trim() || !numeroId.trim()) { setError('Ingresa el número de contrato y el número de identificación.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/postgres/aprobacion/conversion-titular/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato: contrato.trim(), numeroId: numeroId.trim() }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j?.error || 'Error al buscar.'); return }
      if (!j.found) { setError('No se encontró un TITULAR con ese contrato y número de identificación.'); return }
      setTitular(j.titular); setYaConvertido(!!j.yaConvertido)
    } catch {
      setError('Error de red al buscar.')
    } finally { setLoading(false) }
  }

  const convertir = async () => {
    if (!titular) return
    setConverting(true); setError(null)
    try {
      const res = await fetch('/api/postgres/aprobacion/conversion-titular/convertir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato: titular.contrato, numeroId: titular.numeroId }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j?.error || 'Error al convertir.'); return }
      setDone({ beneficiarioNombre: j.beneficiarioNombre, titularNombre: j.titularNombre, titularId: j.titularId })
    } catch {
      setError('Error de red al convertir.')
    } finally { setConverting(false) }
  }

  const reset = () => {
    setContrato(''); setNumeroId(''); setTitular(null); setYaConvertido(false); setError(null); setDone(null)
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={AprobacionPermission.CONVERSION_TITULAR_VER}>
        <div className="space-y-5 max-w-3xl">
          {/* Header */}
          <div className="flex items-center gap-3">
            <ArrowsRightLeftIcon className="h-7 w-7 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Conversión Titular</h1>
              <p className="text-sm text-gray-500">Duplica el titular como beneficiario (lo ubica en WELCOME) para que tome clases.</p>
            </div>
          </div>

          {/* Resultado final */}
          {done ? (
            <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-8 text-center">
              <CheckCircleIcon className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-base font-semibold text-gray-900">Beneficiario creado</p>
              <p className="text-sm text-gray-600 mt-1">
                Se creó el beneficiario <strong>{done.beneficiarioNombre}</strong> para el titular <strong>{done.titularNombre}</strong>.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button type="button" onClick={() => router.push(`/person/${done.titularId}?tab=administracion`)}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Ir al titular (Administración)
                </button>
                <button type="button" onClick={reset}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  Convertir otro
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Paso 1 — búsqueda */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ct-contrato" className="block text-xs text-gray-500 mb-1">Número de contrato</label>
                    <input id="ct-contrato" value={contrato} onChange={e => setContrato(e.target.value)}
                      placeholder="Ej. 01-15368-26"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="ct-numeroid" className="block text-xs text-gray-500 mb-1">Número de identificación del titular</label>
                    <input id="ct-numeroid" value={numeroId} onChange={e => setNumeroId(e.target.value.toUpperCase())}
                      placeholder="Solo letras mayúsculas y números"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="mt-4">
                  <button type="button" onClick={buscar} disabled={loading}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? 'Buscando…' : 'Buscar titular'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              {/* Paso 2 — confirmación */}
              {titular && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <UserIcon className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-800">Datos del titular</h2>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><dt className="text-gray-500">Nombre</dt><dd className="font-medium text-gray-900">{titular.nombre}</dd></div>
                    <div><dt className="text-gray-500">Identificación</dt><dd className="font-medium text-gray-900">{titular.numeroId}</dd></div>
                    <div><dt className="text-gray-500">Celular</dt><dd className="font-medium text-gray-900">{titular.celular || '—'}</dd></div>
                    <div><dt className="text-gray-500">Correo</dt><dd className="font-medium text-gray-900">{titular.email || '—'}</dd></div>
                    <div><dt className="text-gray-500">Contrato</dt><dd className="font-medium text-gray-900">{titular.contrato}</dd></div>
                    <div><dt className="text-gray-500">Plataforma</dt><dd className="font-medium text-gray-900">{titular.plataforma || '—'}</dd></div>
                  </dl>

                  {yaConvertido ? (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      Este titular ya fue convertido en beneficiario para este contrato.
                    </div>
                  ) : (
                    <div className="mt-5 flex items-center gap-2">
                      <button type="button" onClick={convertir} disabled={converting}
                        className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {converting ? 'Convirtiendo…' : 'Confirmar conversión a beneficiario'}
                      </button>
                      <button type="button" onClick={reset}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
