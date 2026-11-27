'use client'

/**
 * "Dejar listo para aprobación" (pantalla del contrato, Comercial) — acordado 2026-11-27.
 * Lista de comprobación (firma, documentos, recibo, PDF en Drive, PDF enviado) con las
 * acciones para resolver lo que falta. NO guarda un estado: "Confirmar" deja constancia en
 * el Seguimiento. Sin firma, con permiso (COMERCIAL.CONTRATO.ANEXAR_SI_ACEPTO o
 * APROBACION.LIBRO_PRODUCCION.RATIFICAR), se anexa la impresión (PDF) del "SÍ, ACEPTO".
 * API: GET/POST /api/postgres/contracts/[id]/listo-aprobacion, POST …/si-acepto.
 */

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircleIcon, XCircleIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'

interface Requisito { clave: 'FIRMA' | 'DOCUMENTOS' | 'RECIBO' | 'DRIVE' | 'ENVIADO'; label: string; ok: boolean; detalle: string }
export interface EstadoListo {
  contrato: string
  aprobacion: string | null
  sinEstado: boolean
  requisitos: Requisito[]
  completo: boolean
  confirmacion: { fecha: string; por: string } | null
  puedeAnexar: boolean
  otrosContratos: { contrato: string; tipoUsuario: string; nombre: string; aprobacion: string | null }[]
}

const fmt = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })

export default function DejarListoAprobacionModal({ titularId, onClose, onCambio, onAbrirDocumentos, onEnviarPdf, enviandoPdf }: {
  titularId: string
  onClose: () => void
  /** Algo cambió (firma, PDF, confirmación): la pantalla recarga el contrato. */
  onCambio: () => void
  /** Abre el modal "Documentación y recibo" de la pantalla. */
  onAbrirDocumentos: () => void
  /** Usa el "Enviar PDF" de la pantalla (genera + WhatsApp + Drive). */
  onEnviarPdf: () => Promise<void>
  enviandoPdf: boolean
}) {
  const [est, setEst] = useState<EstadoListo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  // Sí acepto
  const [sinFirma, setSinFirma] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [declaracion, setDeclaracion] = useState(false)
  const [confirmaOtros, setConfirmaOtros] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setEst(await api.get(`/api/postgres/contracts/${titularId}/listo-aprobacion`))
    } catch (e) {
      handleApiError(e, 'No se pudo comprobar el contrato')
    } finally {
      setCargando(false)
    }
  }, [titularId])
  useEffect(() => { cargar() }, [cargar])

  const accion = async (a: 'confirmar' | 'generar-pdf') => {
    try {
      setTrabajando(a)
      setEst(await api.post(`/api/postgres/contracts/${titularId}/listo-aprobacion`, { accion: a }))
      toast.success(a === 'confirmar' ? 'Contrato dejado listo para aprobación' : 'PDF generado y archivado en el Drive')
      onCambio()
    } catch (e) {
      handleApiError(e, a === 'confirmar' ? 'No se pudo confirmar' : 'No se pudo generar el PDF')
    } finally {
      setTrabajando(null)
    }
  }

  const enviar = async () => {
    await onEnviarPdf()
    await cargar()
  }

  const anexar = async () => {
    if (!archivo) return
    try {
      setTrabajando('si-acepto')
      const fd = new FormData()
      fd.append('file', archivo)
      fd.append('declaracion', String(declaracion))
      fd.append('confirmarOtros', String(confirmaOtros))
      const res = await fetch(`/api/postgres/contracts/${titularId}/si-acepto`, { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.success === false) throw new Error(j?.error || `Error ${res.status}`)
      toast.success('Sí acepto anexado: el contrato queda firmado por correo')
      setSinFirma(false); setArchivo(null); setDeclaracion(false)
      onCambio()
      await cargar()
    } catch (e) {
      handleApiError(e, 'No se pudo anexar el Sí acepto')
    } finally {
      setTrabajando(null)
    }
  }

  const req = (k: Requisito['clave']) => est?.requisitos.find(r => r.clave === k)
  const firmaOk = !!req('FIRMA')?.ok
  const hayOtros = !!est?.otrosContratos.length
  const archivoOk = !!archivo && (archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf'))

  const accionDe = (r: Requisito) => {
    if (r.ok) return null
    const btn = 'rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50'
    switch (r.clave) {
      case 'DOCUMENTOS':
      case 'RECIBO':
        return <button type="button" className={`${btn} border-gray-300 bg-white hover:bg-gray-50`} onClick={onAbrirDocumentos}>Documentación y recibo</button>
      case 'DRIVE':
        return (
          <button type="button" className={`${btn} border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100`}
            disabled={!!trabajando} onClick={() => accion('generar-pdf')}>
            {trabajando === 'generar-pdf' ? 'Generando…' : 'Generar PDF'}
          </button>
        )
      case 'ENVIADO':
        return (
          <button type="button" className={`${btn} border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100`}
            disabled={enviandoPdf || !!trabajando} onClick={enviar}>
            {enviandoPdf ? 'Enviando…' : 'Enviar PDF'}
          </button>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Dejar listo para aprobación</h3>
            {est && <p className="text-xs text-gray-500">Contrato {est.contrato}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={cargar} title="Volver a comprobar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <ArrowPathIcon className={`h-5 w-5 ${cargando ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {!est ? (
            <p className="py-6 text-center text-gray-500">{cargando ? 'Comprobando…' : 'Sin datos'}</p>
          ) : !est.sinEstado ? (
            <p className="rounded-md bg-gray-50 p-3 text-gray-700">
              El contrato tiene estado <b>{est.aprobacion}</b>: lo gestiona Aprobación desde su panel.
            </p>
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {est.requisitos.map(r => (
                  <li key={r.clave} className="flex items-center gap-3 px-3 py-2">
                    {r.ok
                      ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-green-600" />
                      : <XCircleIcon className="h-5 w-5 flex-shrink-0 text-red-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{r.label}</p>
                      <p className="truncate text-xs text-gray-500">
                        {r.clave === 'ENVIADO' && r.detalle.startsWith('Enviado el ') ? `Enviado el ${fmt(r.detalle.slice(11))}` : r.detalle}
                      </p>
                    </div>
                    {accionDe(r)}
                  </li>
                ))}
              </ul>

              {/* Sin firma: anexar la impresión del "SÍ, ACEPTO" (solo PDF) */}
              {!firmaOk && (
                est.puedeAnexar ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" className="mt-0.5" checked={sinFirma} onChange={e => setSinFirma(e.target.checked)} />
                      <span><b>No tiene firma:</b> anexar la impresión del <b>Sí acepto</b> (PDF)</span>
                    </label>
                    {sinFirma && (
                      <div className="mt-3 space-y-3">
                        <input type="file" accept="application/pdf,.pdf"
                          onChange={e => setArchivo(e.target.files?.[0] || null)}
                          className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-white" />
                        {archivo && !archivoOk && <p className="text-xs text-red-600">Solo se acepta PDF.</p>}
                        <p className="text-xs text-gray-600">
                          Cuenta como firma del contrato: el PDF queda en la documentación, el contrato impreso agrega
                          «Aceptación realizada por medio de correo electrónico adjuntado a los documentos» y se archiva en el Drive.
                        </p>
                        <label className="flex items-start gap-2 text-xs">
                          <input type="checkbox" className="mt-0.5" checked={declaracion} onChange={e => setDeclaracion(e.target.checked)} />
                          <span>Confirmo que el correo es del titular (el correo del contrato) y que acepta este contrato.</span>
                        </label>
                        {hayOtros && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                            El titular tiene otros contratos: {est.otrosContratos.map(o => `${o.contrato} (${o.tipoUsuario.toLowerCase()}${o.aprobacion ? ` · ${o.aprobacion}` : ''})`).join(', ')}.
                            <label className="mt-1 flex items-start gap-2">
                              <input type="checkbox" className="mt-0.5" checked={confirmaOtros} onChange={e => setConfirmaOtros(e.target.checked)} />
                              <span>Entiendo y anexo el Sí acepto a <b>este</b> contrato.</span>
                            </label>
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button type="button" onClick={anexar}
                            disabled={!archivoOk || !declaracion || (hayOtros && !confirmaOtros) || !!trabajando}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {trabajando === 'si-acepto' ? 'Anexando…' : 'Anexar Sí acepto'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Sin firma. Solicite la firma al titular («Solicitar firma»); anexar el Sí acepto por correo requiere permiso.</p>
                )
              )}

              {est.confirmacion && (
                <p className="text-xs text-gray-500">Confirmado por {est.confirmacion.por} el {fmt(est.confirmacion.fecha)}.</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Cerrar</button>
          {est?.sinEstado && (
            <button type="button" onClick={() => accion('confirmar')}
              disabled={!est.completo || !!trabajando}
              title={est.completo ? '' : 'Complete los requisitos en rojo'}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
              {trabajando === 'confirmar' ? 'Confirmando…' : est.confirmacion ? 'Confirmar de nuevo' : 'Confirmar listo para aprobación'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
