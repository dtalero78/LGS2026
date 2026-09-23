'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon, AcademicCapIcon, LockClosedIcon } from '@heroicons/react/24/outline'

type Nivel = 'beginner' | 'practical' | 'functional'
interface NivelInfo { aprobado: boolean; fecha: string | null; yaGenerado?: boolean }
interface Estado { nombre: string; numeroId: string; niveles: Record<Nivel, NivelInfo> }

const NIVELES: { key: Nivel; label: string; cls: string }[] = [
  { key: 'beginner',   label: 'Beginner',   cls: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-950' },
  { key: 'practical',  label: 'Practical',  cls: 'bg-red-600 hover:bg-red-700 text-white' },
  { key: 'functional', label: 'Functional', cls: 'bg-blue-700 hover:bg-blue-800 text-white' },
]

/**
 * Modal de descarga de certificados de nivel. `baseUrl` es el endpoint que:
 *   - sin query → devuelve el estado por nivel (aprobado + fecha)
 *   - `?nivel=` → devuelve el PDF (cifrado con el documento del alumno)
 * Panel estudiante: /api/postgres/panel-estudiante/certificado
 * Admin:            /api/postgres/students/{id}/certificado
 */
export default function CertificadosModal({ baseUrl, onClose }: { baseUrl: string; onClose: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fetch(baseUrl, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (alive) setEstado(d && d.success === false ? null : d) })
      .catch(() => { if (alive) setError('No se pudo cargar el estado de certificados') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [baseUrl])

  const descargar = (nivel: Nivel) => {
    window.open(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}nivel=${nivel}`, '_blank', 'noopener,noreferrer')
    // El certificado se genera UNA sola vez: al descargarlo, deshabilita el botón.
    // (El servidor es la autoridad; al reabrir el modal se refleja el estado real.)
    setEstado(prev => prev
      ? { ...prev, niveles: { ...prev.niveles, [nivel]: { ...prev.niveles[nivel], yaGenerado: true } } }
      : prev)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AcademicCapIcon className="h-5 w-5 text-blue-600" /> Certificados
          </h2>
          <button type="button" onClick={onClose} title="Cerrar" className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Certificado de finalización de nivel. Solo se habilitan los niveles ya aprobados
          (Beginner = Jump 15, Practical = Jump 30, Functional = Jump 45). El PDF sale
          protegido con el <strong>número de documento</strong>.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 italic text-center py-4">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-red-600 text-center py-4">{error}</p>
        ) : (
          <div className="space-y-2">
            {NIVELES.map(({ key, label, cls }) => {
              const info = estado?.niveles?.[key]
              const aprobado = !!info?.aprobado
              const yaGenerado = !!info?.yaGenerado
              const habilitado = aprobado && !yaGenerado
              const leyenda = !aprobado
                ? 'No ha aprobado el nivel, certificado no disponible'
                : yaGenerado
                  ? 'Ya generaste este certificado (solo se puede una vez)'
                  : null
              return (
                <div key={key}>
                  <button
                    type="button"
                    disabled={!habilitado}
                    onClick={() => habilitado && descargar(key)}
                    title={habilitado ? `Descargar certificado ${label}` : (leyenda ?? label)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${habilitado ? cls : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    {habilitado ? <AcademicCapIcon className="h-5 w-5" /> : <LockClosedIcon className="h-4 w-4" />}
                    {label}
                    {yaGenerado && aprobado && <span className="text-[11px] font-normal">· generado</span>}
                  </button>
                  {leyenda && (
                    <p className="mt-0.5 text-[11px] text-gray-400 text-center">{leyenda}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
