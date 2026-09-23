'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Nivel = 'beginner' | 'practical' | 'functional'
interface Plantilla { nivel: Nivel; label: string; customizado: boolean; url: string }

const ACCENT: Record<Nivel, string> = {
  beginner: 'border-yellow-400',
  practical: 'border-red-500',
  functional: 'border-blue-600',
}

export default function CertificadosPlantillasPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<Nivel | null>(null)
  const [bust, setBust] = useState(0) // fuerza recarga del preview tras subir
  const inputs = useRef<Record<Nivel, HTMLInputElement | null>>({ beginner: null, practical: null, functional: null })

  const cargar = () => {
    setLoading(true); setError(null)
    fetch('/api/postgres/materials/certificado-plantilla', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.success) { setPlantillas(d.plantillas); setBust(Date.now()) }
        else setError(d?.error || 'No se pudo cargar el estado de las plantillas')
      })
      .catch(() => setError('No se pudo cargar el estado de las plantillas'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const onFile = async (nivel: Nivel, file: File | undefined) => {
    if (!file) return
    if (!/\.png$/i.test(file.name) && !/image\/png/i.test(file.type)) {
      toast.error('La plantilla debe ser una imagen PNG')
      return
    }
    setSubiendo(nivel)
    try {
      const fd = new FormData()
      fd.append('nivel', nivel)
      fd.append('file', file)
      const res = await fetch('/api/postgres/materials/certificado-plantilla', {
        method: 'POST', body: fd, credentials: 'include',
      })
      const d = await res.json()
      if (!res.ok || !d?.success) throw new Error(d?.error || 'Error al subir la plantilla')
      toast.success('Plantilla actualizada')
      cargar()
    } catch (e: any) {
      toast.error(e?.message || 'Error al subir la plantilla')
    } finally {
      setSubiendo(null)
      if (inputs.current[nivel]) inputs.current[nivel]!.value = ''
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Plantillas de Certificados</h1>
      <p className="text-gray-500 mb-2">
        Reemplaza el arte de fondo de cada certificado (Beginner / Practical / Functional).
      </p>
      <p className="text-sm text-gray-400 mb-8">
        Formato <strong>PNG</strong>, horizontal, idealmente <strong>3300×2550 px</strong> (relación 1.294:1).
        El "60 hours of instruction" va impreso en la plantilla; el sistema solo agrega el <strong>nombre</strong>{' '}
        y la <strong>fecha</strong> de aprobación al generar. Los cambios aplican de inmediato a los certificados nuevos.
      </p>

      {loading ? (
        <p className="text-gray-400 italic">Cargando…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plantillas.map((p) => (
            <div key={p.nivel} className={`bg-white border-2 rounded-2xl shadow-sm overflow-hidden ${ACCENT[p.nivel]}`}>
              <div className="p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{p.label}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.customizado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.customizado ? 'Personalizada' : 'Por defecto'}
                </span>
              </div>
              {/* Preview */}
              <div className="bg-gray-50 border-y border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${p.url}${p.url.includes('?') ? '&' : '?'}v=${bust}`}
                  alt={`Plantilla ${p.label}`}
                  className="w-full aspect-[1.294/1] object-contain"
                />
              </div>
              {/* Acción */}
              <div className="p-4">
                <input
                  ref={(el) => { inputs.current[p.nivel] = el }}
                  type="file"
                  accept="image/png,.png"
                  className="hidden"
                  onChange={(e) => onFile(p.nivel, e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={subiendo === p.nivel}
                  onClick={() => inputs.current[p.nivel]?.click()}
                  className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {subiendo === p.nivel ? 'Subiendo…' : 'Reemplazar plantilla'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
