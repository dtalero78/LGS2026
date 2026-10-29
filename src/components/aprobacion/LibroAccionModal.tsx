'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon, ArrowDownTrayIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'

/**
 * Libro de Producción › casillas de la celda Item.
 *  - depurar  (pestaña Libro, firmado sin aprobar): descargar documentos y recibos →
 *    motivo → borrar el contrato (POST …/depurar).
 *  - ratificar (pestaña Sin firmar): adjuntar el correo "SÍ, ACEPTO" → firma por
 *    correo electrónico (POST …/ratificar).
 * En ambos, si el titular tiene otros contratos se avisa y se exige confirmar.
 */
interface Previa {
  titular: { id: string; contrato: string; nombre: string; documento: string; aprobacion: string | null; firmado: boolean }
  beneficiarios: number
  documentos: { grupo: string; nombre: string; url: string }[]
  pagos: { total: number; validados: number }
  otrosContratos: { contrato: string; tipoUsuario: string; nombre: string; aprobacion: string | null; estado: string | null; firmado: boolean }[]
  depurable: boolean; motivoNoDepurable: string | null
  ratificable: boolean; motivoNoRatificable: string | null
}

const estadoOtro = (o: Previa['otrosContratos'][number]) =>
  o.aprobacion && !['', 'pendiente'].includes(o.aprobacion.toLowerCase()) ? o.aprobacion : o.firmado ? 'Pendiente aprobación' : 'Sin firmar'

export default function LibroAccionModal({ titularId, accion, onClose, onDone }: {
  titularId: string
  accion: 'depurar' | 'ratificar'
  onClose: () => void
  onDone: () => void
}) {
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [descargados, setDescargados] = useState<Set<string>>(new Set())
  const [motivo, setMotivo] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [confirmaOtros, setConfirmaOtros] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    api.get<Previa>(`/api/postgres/libro-produccion/${titularId}/depuracion`)
      .then(d => { if (vivo) setPrevia(d) })
      .catch(e => { handleApiError(e, 'No se pudo cargar el contrato'); onClose() })
    return () => { vivo = false }
  }, [titularId]) // eslint-disable-line react-hooks/exhaustive-deps

  const esDepurar = accion === 'depurar'
  const aplica = previa ? (esDepurar ? previa.depurable : previa.ratificable) : false
  const motivoNo = previa ? (esDepurar ? previa.motivoNoDepurable : previa.motivoNoRatificable) : null
  const hayOtros = !!previa?.otrosContratos.length
  const todosDescargados = !!previa && previa.documentos.every(d => descargados.has(d.url))
  const listo = aplica && (!hayOtros || confirmaOtros) && (esDepurar
    ? todosDescargados && motivo.trim().length >= 10
    : !!archivo)

  const descargarTodos = () => {
    // Uno por pestaña; si el navegador bloquea ventanas emergentes, quedan los enlaces individuales.
    previa?.documentos.forEach(d => window.open(d.url, '_blank', 'noopener'))
    setDescargados(new Set(previa?.documentos.map(d => d.url)))
  }

  const confirmar = async () => {
    if (!previa || !listo) return
    setEnviando(true)
    try {
      if (esDepurar) {
        const r = await api.post<{ borrados?: Record<string, number> }>(`/api/postgres/libro-produccion/${titularId}/depurar`, {
          motivo: motivo.trim(), documentosDescargados: true, confirmarOtros: confirmaOtros,
        })
        toast.success(`Contrato ${previa.titular.contrato} depurado (${r.borrados?.people ?? 0} personas, ${r.borrados?.pagos ?? 0} pagos)`)
      } else {
        const fd = new FormData()
        fd.append('file', archivo!)
        fd.append('confirmarOtros', String(confirmaOtros))
        const res = await fetch(`/api/postgres/libro-produccion/${titularId}/ratificar`, { method: 'POST', body: fd })
        const j = await res.json().catch(() => ({}))
        if (!res.ok || j?.success === false) throw new Error(j?.error || `Error ${res.status}`)
        toast.success(`Contrato ${previa.titular.contrato} ratificado por correo: pasa a Pendiente aprobación`)
      }
      onDone()
    } catch (e) {
      handleApiError(e, esDepurar ? 'No se pudo depurar' : 'No se pudo ratificar')
    } finally {
      setEnviando(false)
    }
  }

  const color = esDepurar ? 'red' : 'emerald'
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 flex items-start justify-between gap-3 rounded-t-xl ${esDepurar ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <div>
            <h2 className="text-lg font-bold text-white">{esDepurar ? 'Depurar contrato' : 'Ratificar contrato por correo'}</h2>
            {previa && <p className="text-white/90 text-xs mt-0.5">{previa.titular.contrato} · {previa.titular.nombre} · ID {previa.titular.documento}</p>}
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="text-white/80 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        {!previa ? (
          <p className="p-10 text-center text-sm text-gray-400 italic">Cargando…</p>
        ) : (
          <div className="p-5 space-y-4 text-sm">
            {!aplica && (
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-700">{motivoNo}</div>
            )}

            {aplica && esDepurar && (
              <>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-xs">
                  Se borran <b>definitivamente</b> el titular, sus {previa.beneficiarios} beneficiario(s), el registro financiero y {previa.pagos.total} pago(s) registrado(s).
                  La ficha académica y el acceso se conservan si la persona tiene otro contrato. Queda copia completa en el registro de depuraciones.
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-semibold text-gray-800">1. Descargue los documentos y recibos</h3>
                    {previa.documentos.length > 1 && (
                      <button type="button" onClick={descargarTodos} className="text-xs font-semibold text-indigo-700 hover:underline">Descargar todos</button>
                    )}
                  </div>
                  {previa.documentos.length ? (
                    <ul className="divide-y rounded-lg border border-gray-200">
                      {previa.documentos.map(d => (
                        <li key={d.url} className="flex items-center gap-2 px-3 py-2">
                          {descargados.has(d.url)
                            ? <CheckCircleIcon className="h-4 w-4 text-green-600 shrink-0" />
                            : <ArrowDownTrayIcon className="h-4 w-4 text-gray-400 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] text-gray-500">{d.grupo}</div>
                            <div className="truncate text-gray-800" title={d.nombre}>{d.nombre}</div>
                          </div>
                          <a href={d.url} target="_blank" rel="noopener noreferrer" download
                            onClick={() => setDescargados(s => new Set(s).add(d.url))}
                            className="shrink-0 text-xs font-semibold text-indigo-700 hover:underline">Descargar</a>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-gray-500">El contrato no tiene documentos ni recibos adjuntos.</p>}
                  {!todosDescargados && <p className="mt-1 text-[11px] text-amber-700">Descargue cada archivo para habilitar la depuración.</p>}
                </div>
                <label className="block">
                  <span className="font-semibold text-gray-800">2. Motivo</span>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={500}
                    placeholder="Ej.: contrato duplicado por error del ejecutivo; el real es 01-…"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                  <span className="text-[11px] text-gray-500">Mínimo 10 caracteres.</span>
                </label>
              </>
            )}

            {aplica && !esDepurar && (
              <>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 text-xs">
                  El correo en que el titular responde <b>"SÍ, ACEPTO"</b> queda adjunto a la documentación y cuenta como firma: el contrato pasa a
                  <b> Pendiente aprobación</b> y, bajo el "SÍ, ACEPTO", se imprime: <i>"Aceptación realizada por medio de correo electrónico adjuntado a los documentos"</i>.
                </div>
                <label className="block">
                  <span className="font-semibold text-gray-800">Correo "SÍ, ACEPTO" del titular</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.eml,.msg"
                    onChange={e => setArchivo(e.target.files?.[0] || null)}
                    className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-emerald-700" />
                  <span className="text-[11px] text-gray-500">PDF o captura del correo, o el archivo del correo (.eml / .msg). Máximo 20 MB.</span>
                </label>
              </>
            )}

            {aplica && hayOtros && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <ExclamationTriangleIcon className="h-5 w-5" /> El titular tiene otros contratos
                </div>
                <ul className="text-xs text-amber-900 space-y-0.5">
                  {previa.otrosContratos.map((o, i) => (
                    <li key={`${o.contrato}-${i}`}>• <b>{o.contrato}</b> — {o.tipoUsuario === 'TITULAR' ? 'titular' : 'beneficiario'} · {estadoOtro(o)}</li>
                  ))}
                </ul>
                <label className="flex items-start gap-2 text-xs text-amber-900">
                  <input type="checkbox" checked={confirmaOtros} onChange={e => setConfirmaOtros(e.target.checked)} className="mt-0.5" />
                  <span>{esDepurar ? 'Confirmo la depuración de este contrato; los otros contratos no se tocan.' : 'Confirmo la ratificación de este contrato.'}</span>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 bg-gray-50 border-t rounded-b-xl flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            {aplica ? 'Cancelar' : 'Cerrar'}
          </button>
          {aplica && (
            <button type="button" onClick={confirmar} disabled={!listo || enviando}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-md disabled:opacity-50 ${color === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {enviando ? (esDepurar ? 'Depurando…' : 'Ratificando…') : (esDepurar ? 'Depurar definitivamente' : 'Ratificar')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
