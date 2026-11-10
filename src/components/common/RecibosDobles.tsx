'use client'

/**
 * "El pago tiene varios recibos" — espacios (Recibo 1 … Recibo 5) para subir los
 * comprobantes de UN mismo pago. Lo usan el modal Registrar Pago, "Documentación
 * y recibo" (inscripción) y el botón "Recibo" del gestor en el Centro de Validación.
 *
 * Empieza con 2 espacios; "+ Agregar recibo(s)" suma más (se pueden elegir varios
 * archivos a la vez) hasta MAX_RECIBOS. Si `leerConIA`, cada recibo se lee al
 * subirlo y se muestra su monto + la suma; el padre usa `sumaLeida()` para
 * precargar el valor del pago (editable).
 */
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '@/hooks/use-api'
import { MAX_RECIBOS, MIN_RECIBOS } from '@/lib/recibos-multiples'

export interface ReciboArchivo {
  url: string
  nombre: string
  tipo?: string
  fechaSubida?: string
  /** Monto que leyó la IA (solo referencia). */
  montoLeido?: number | null
  /** Todo lo que leyó la IA (medio, fecha, monto, referencia, banco, confianza). */
  extraido?: any
}

interface Props {
  /** Carpeta de subida (PEOPLE._id del titular) para /api/contracts/[id]/upload-url. */
  carpetaId: string
  recibos: (ReciboArchivo | null)[]
  onChange: (recibos: (ReciboArchivo | null)[]) => void
  /** Lee cada recibo con IA al subirlo (requiere lectura de recibos habilitada). */
  leerConIA?: boolean
  /** Datos leídos de un recibo (por índice), para que el padre precargue lo que quiera. */
  onLeido?: (indice: number, extraido: any) => void
  disabled?: boolean
}

export const fmtPesos = (n: number) => '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)

/** Recibos ya adjuntados (sin los espacios vacíos). */
export function recibosAdjuntos(recibos: (ReciboArchivo | null)[]): ReciboArchivo[] {
  return recibos.filter((r): r is ReciboArchivo => !!r)
}

/** Suma de los montos leídos por IA de los recibos adjuntos, o null si son menos de 2 o falta alguno. */
export function sumaLeida(recibos: (ReciboArchivo | null)[]): number | null {
  const adj = recibosAdjuntos(recibos)
  if (adj.length < MIN_RECIBOS) return null
  const montos = adj.map(r => (r.montoLeido != null ? Number(r.montoLeido) : NaN))
  return montos.every(m => Number.isFinite(m)) ? montos.reduce((a, b) => a + b, 0) : null
}

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf'

export default function RecibosDobles({ carpetaId, recibos, onChange, leerConIA, onLeido, disabled }: Props) {
  const [subiendo, setSubiendo] = useState<number | null>(null)
  // Última lista emitida: varias subidas seguidas no se pisan entre sí.
  const actual = useRef(recibos)
  actual.current = recibos
  const emitir = (n: (ReciboArchivo | null)[]) => { actual.current = n; onChange(n) }

  const subirArchivo = async (indice: number, file: File): Promise<ReciboArchivo | null> => {
    try {
      const fd = new FormData(); fd.append('file', file)
      const up = await fetch(`/api/contracts/${carpetaId}/upload-url`, { method: 'POST', body: fd })
      if (!up.ok) { const e = await up.json().catch(() => ({} as any)); throw new Error(e.details || e.error || `Error ${up.status}`) }
      const { publicUrl } = await up.json()
      let montoLeido: number | null = null
      let extraido: any = null
      if (leerConIA) {
        try {
          const d = await api.post<{ extraido: any }>('/api/postgres/recaudos/inscripcion-recibo/extraer', { url: publicUrl })
          extraido = d.extraido || {}
          montoLeido = extraido.monto != null && Number.isFinite(Number(extraido.monto)) ? Number(extraido.monto) : null
          onLeido?.(indice, extraido)
        } catch {
          toast.error(`No se pudo leer el recibo ${indice + 1}; quedó adjunto igual`)
        }
      }
      return { url: publicUrl, nombre: file.name, tipo: file.type, fechaSubida: new Date().toISOString(), montoLeido, extraido }
    } catch (e: any) {
      toast.error(`Error subiendo el recibo ${indice + 1}: ${e?.message || ''}`)
      return null
    }
  }

  /** Sube un archivo al espacio `indice` (Subir / Cambiar). */
  const subirEn = async (indice: number, file: File) => {
    setSubiendo(indice)
    const r = await subirArchivo(indice, file)
    if (r) {
      const n = [...actual.current]; n[indice] = r; emitir(n)
      toast.success(`Recibo ${indice + 1} adjuntado`)
    }
    setSubiendo(null)
  }

  /** Agrega uno o varios archivos: llena los espacios vacíos y abre nuevos hasta el tope. */
  const agregarVarios = async (files: File[]) => {
    let subidos = 0
    for (const file of files) {
      let n = [...actual.current]
      let idx = n.findIndex(x => !x)
      if (idx === -1) {
        if (n.length >= MAX_RECIBOS) { toast.error(`Máximo ${MAX_RECIBOS} recibos por pago`); break }
        n.push(null); idx = n.length - 1; emitir(n)
      }
      setSubiendo(idx)
      const r = await subirArchivo(idx, file)
      n = [...actual.current]
      if (r) { n[idx] = r; subidos++ } else if (idx >= MIN_RECIBOS && !n[idx]) n.splice(idx, 1)
      emitir(n)
    }
    setSubiendo(null)
    if (subidos > 0) toast.success(subidos === 1 ? 'Recibo adjuntado' : `${subidos} recibos adjuntados`)
  }

  const elegir = (multiple: boolean, cb: (files: File[]) => void) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    input.accept = ACCEPT
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => { const fs = Array.from(input.files || []); if (fs.length) cb(fs); document.body.removeChild(input) })
    input.click()
  }

  // Los espacios 1 y 2 se vacían; del 3 en adelante el espacio se elimina.
  const quitar = (indice: number) => {
    const n = [...actual.current]
    if (indice >= MIN_RECIBOS) n.splice(indice, 1); else n[indice] = null
    emitir(n)
  }

  const ocupado = disabled || subiendo !== null
  const adjuntos = recibosAdjuntos(recibos).length
  const puedeAgregar = recibos.length < MAX_RECIBOS || recibos.some(r => !r)
  const suma = sumaLeida(recibos)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {recibos.map((r, i) => (
          <div key={i} className={`rounded-md border p-2.5 text-sm ${r ? 'border-emerald-200 bg-emerald-50' : 'border-dashed border-gray-300 bg-white'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-gray-800">Recibo {i + 1}</span>
              {r ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => elegir(false, fs => subirEn(i, fs[0]))} disabled={ocupado}
                    className="text-xs text-indigo-600 hover:underline disabled:opacity-50">Cambiar</button>
                  <button type="button" onClick={() => quitar(i)} disabled={ocupado}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50">Quitar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {i >= MIN_RECIBOS && (
                    <button type="button" onClick={() => quitar(i)} disabled={ocupado}
                      className="text-xs text-gray-500 hover:underline disabled:opacity-50">Quitar</button>
                  )}
                  <button type="button" onClick={() => elegir(false, fs => subirEn(i, fs[0]))} disabled={ocupado}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50">
                    {subiendo === i ? (leerConIA ? 'Leyendo…' : 'Subiendo…') : `Subir recibo ${i + 1}`}
                  </button>
                </div>
              )}
            </div>
            {r && (
              <div className="mt-1 min-w-0">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-800 hover:underline break-all">{r.nombre}</a>
                {leerConIA && (
                  <div className="text-xs text-gray-600">
                    Monto leído: {r.montoLeido != null ? <strong>{fmtPesos(Number(r.montoLeido))}</strong> : <span className="italic">no se pudo leer</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-500">{adjuntos} de {MAX_RECIBOS} recibos adjuntos</span>
        {puedeAgregar && (
          <button type="button" onClick={() => elegir(true, agregarVarios)} disabled={ocupado}
            title={`Puedes elegir varios archivos a la vez (máximo ${MAX_RECIBOS} recibos)`}
            className="px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-300 bg-white rounded hover:bg-emerald-50 disabled:opacity-50">
            + Agregar recibo(s)
          </button>
        )}
      </div>
      {leerConIA && suma != null && (
        <p className="text-xs text-gray-600">Suma leída de los {adjuntos} recibos: <strong>{fmtPesos(suma)}</strong> — se precarga en el valor; revísalo antes de guardar.</p>
      )}
    </div>
  )
}
