'use client'

import { useEffect, useState } from 'react'
import { FileText, Upload, Receipt, Trash2, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { PersonPermission } from '@/types/permissions'
import RecibosDobles, { type ReciboArchivo, fmtPesos } from '@/components/common/RecibosDobles'

// Detecta si un archivo es imagen (por su mime o su extensión en la URL).
function esImagen(tipo?: string, url?: string): boolean {
  if (String(tipo || '').startsWith('image/')) return true
  return /\.(jpe?g|png|webp|heic|gif|bmp)(\?|#|$)/i.test(String(url || ''))
}

/**
 * Modal unificado para gestionar la DOCUMENTACIÓN y el RECIBO de inscripción de un
 * contrato (dos secciones separadas). Reutilizable: se usa en Matrículas
 * (Firmado sin aprobar) y en la ficha de persona (Agregar Documentación).
 *
 * `personId` = PEOPLE._id del titular (los endpoints existentes trabajan sobre él):
 *   - Documentación: GET/POST/DELETE /api/contracts/[id]/documents
 *   - Recibo:        GET/POST        /api/contracts/[id]/recibo-inscripcion
 * El recibo respeta su gate (permiso SUBIR_RECIBO + flag leer_recibo_activo): el GET
 * devuelve `active` y si no está habilitado se oculta el botón de subir.
 */
interface Props {
  open: boolean
  personId: string | null
  /** Subtítulo del header, ej: "ANA VIVERO · Contrato 01-16281-26". */
  subtitulo?: string
  onClose: () => void
}

export default function DocumentosReciboModal({ open, personId, subtitulo, onClose }: Props) {
  const { hasPermission } = usePermissions()
  const puedeSubirDoc = hasPermission(PersonPermission.ADICION_DOCUMENTACION)
  const puedeEliminarDoc = hasPermission(PersonPermission.ELIMINAR_DOCUMENTACION)
  const [docsList, setDocsList] = useState<any[]>([])
  const [reciboData, setReciboData] = useState<any | null>(null)
  const [reciboActive, setReciboActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadingRecibo, setUploadingRecibo] = useState(false)
  // "El pago tiene dos recibos": se suben los dos y el monto se digita a mano.
  const [dosRecibos, setDosRecibos] = useState(false)
  const [recibosDobles, setRecibosDobles] = useState<(ReciboArchivo | null)[]>([null, null])
  const [montoManual, setMontoManual] = useState('')
  const [pagoInscripcion, setPagoInscripcion] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !personId) return
    setDocsList([]); setReciboData(null); setReciboActive(false); setLoading(true)
    setDosRecibos(false); setRecibosDobles([null, null]); setMontoManual(''); setPagoInscripcion(null)
    Promise.all([
      fetch(`/api/contracts/${personId}/documents`).then(x => x.json()).catch(() => null),
      fetch(`/api/contracts/${personId}/recibo-inscripcion`).then(x => x.json()).catch(() => null),
    ]).then(([d, r]) => {
      if (d?.success) setDocsList(d.documentacion || [])
      if (r?.success) { setReciboData(r.recibo || null); setReciboActive(!!r.active); setPagoInscripcion(r.pagoInscripcion ?? null) }
    }).finally(() => setLoading(false))
  }, [open, personId])

  if (!open || !personId) return null

  const uploadDocs = async (files: File[]) => {
    if (!files.length) return
    setUploadingDoc(true)
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const up = await fetch(`/api/contracts/${personId}/upload-url`, { method: 'POST', body: fd })
        if (!up.ok) { const e = await up.json().catch(() => ({})); throw new Error(e.error || `Error ${up.status}`) }
        const { publicUrl } = await up.json()
        const saved = await fetch(`/api/contracts/${personId}/documents`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: publicUrl, nombre: file.name, tipo: file.type }),
        }).then(x => x.json())
        if (saved?.success) setDocsList(saved.documentacion || [])
      }
      toast.success('Documentación subida')
    } catch (e: any) { toast.error(e?.message || 'Error subiendo documentación') } finally { setUploadingDoc(false) }
  }

  const deleteDoc = async (url: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    try {
      const d = await fetch(`/api/contracts/${personId}/documents`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      }).then(x => x.json())
      if (d?.success) setDocsList(d.documentacion || [])
    } catch { toast.error('No se pudo eliminar') }
  }

  const uploadRecibo = async (file: File) => {
    setUploadingRecibo(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const up = await fetch(`/api/contracts/${personId}/upload-url`, { method: 'POST', body: fd })
      if (!up.ok) { const e = await up.json().catch(() => ({})); throw new Error(e.error || `Error ${up.status}`) }
      const { publicUrl } = await up.json()
      const saved = await fetch(`/api/contracts/${personId}/recibo-inscripcion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: publicUrl, nombre: file.name, tipo: file.type }),
      }).then(x => x.json())
      if (!saved?.success) throw new Error(saved?.error || 'No se pudo guardar el recibo')
      setReciboData(saved.recibo || null)
      toast.success('Recibo de inscripción subido')
    } catch (e: any) { toast.error(e?.message || 'Error subiendo el recibo') } finally { setUploadingRecibo(false) }
  }

  const montoNum = Number(montoManual.replace(/[^0-9]/g, '')) || 0
  const difiereInscripcion = dosRecibos && montoNum > 0 && pagoInscripcion != null && Math.round(montoNum) !== Math.round(pagoInscripcion)

  const guardarDosRecibos = async () => {
    if (!recibosDobles[0] || !recibosDobles[1]) { toast.error('Adjunta el recibo 1 y el recibo 2'); return }
    if (montoNum <= 0) { toast.error('Digita el monto total del pago (los dos recibos juntos)'); return }
    setUploadingRecibo(true)
    try {
      const saved = await fetch(`/api/contracts/${personId}/recibo-inscripcion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dosRecibos: true,
          montoManual: montoNum,
          recibos: recibosDobles.map(r => ({ url: r!.url, nombre: r!.nombre, tipo: r!.tipo })),
        }),
      }).then(x => x.json())
      if (!saved?.success) throw new Error(saved?.error || 'No se pudieron guardar los recibos')
      setReciboData(saved.recibo || null)
      setDosRecibos(false); setRecibosDobles([null, null]); setMontoManual('')
      toast.success('Recibos de inscripción guardados')
    } catch (e: any) { toast.error(e?.message || 'Error guardando los recibos') } finally { setUploadingRecibo(false) }
  }

  const pickFiles = (multiple: boolean, cb: (files: File[]) => void) => {
    const i = document.createElement('input')
    i.type = 'file'; i.multiple = multiple; i.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf'
    i.onchange = () => { cb(Array.from(i.files || [])) }
    i.click()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-auto">
        <div className="flex justify-between items-center p-5 border-b border-indigo-100 bg-indigo-50 rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2"><FileText className="w-5 h-5" /> Documentación y recibo</h3>
            {subtitulo && <p className="text-xs text-gray-600 mt-0.5">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-6">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Cargando…</div>
          ) : (
            <>
              {/* Documentación */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><FileText className="w-4 h-4 text-indigo-600" /> Documentación</h4>
                  {puedeSubirDoc && (
                    <button type="button" onClick={() => pickFiles(true, uploadDocs)} disabled={uploadingDoc}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                      <Upload className="w-3.5 h-3.5" /> {uploadingDoc ? 'Subiendo…' : 'Subir documentos'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">Documentos requeridos para la aprobación (imágenes o PDF). El recibo de pago va en la sección de abajo.</p>
                {docsList.length === 0 ? (
                  <div className="text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg p-4 text-center">Sin documentos aún.</div>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                    {docsList.map((d: any, i: number) => {
                      const img = esImagen(d.tipo, d.url)
                      return (
                        <li key={i} className="flex items-center gap-3 px-3 py-2">
                          <a href={d.url} target="_blank" rel="noopener noreferrer" title="Ver" className="shrink-0">
                            {img ? (
                              <img src={d.url} alt={d.nombre || 'documento'} className="h-12 w-12 rounded object-cover border border-gray-200 hover:ring-2 hover:ring-indigo-300" />
                            ) : (
                              <span className="h-12 w-12 rounded bg-red-50 border border-red-100 flex items-center justify-center"><FileText className="w-6 h-6 text-red-400" /></span>
                            )}
                          </a>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{d.nombre || 'Documento'}</p>
                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> Ver {img ? 'imagen' : 'documento'}
                            </a>
                          </div>
                          {puedeEliminarDoc && (
                            <button type="button" onClick={() => deleteDoc(d.url, d.nombre || 'documento')} title="Eliminar" className="text-red-400 hover:text-red-600 shrink-0"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {/* Recibo de inscripción */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-emerald-600" /> Recibo de inscripción</h4>
                  {reciboActive && !dosRecibos && (
                    <button type="button" onClick={() => pickFiles(false, fs => { if (fs[0]) uploadRecibo(fs[0]) })} disabled={uploadingRecibo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                      <Upload className="w-3.5 h-3.5" /> {uploadingRecibo ? 'Subiendo…' : (reciboData ? 'Reemplazar recibo' : 'Subir recibo')}
                    </button>
                  )}
                </div>
                {!reciboActive && !reciboData && (
                  <p className="text-xs text-amber-600 mb-2">La subida del recibo no está habilitada para tu usuario (requiere el permiso «Subir recibo» o que la lectura de recibos esté activa).</p>
                )}
                {reciboActive && (
                  <div className={`mb-3 rounded-lg border p-3 space-y-3 ${dosRecibos ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200 bg-gray-50'}`}>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer select-none">
                      <input type="checkbox" checked={dosRecibos}
                        onChange={() => { setDosRecibos(d => !d); setRecibosDobles([null, null]); setMontoManual('') }}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                      El pago tiene dos recibos
                    </label>
                    {dosRecibos && (
                      <>
                        <RecibosDobles carpetaId={personId} recibos={recibosDobles} onChange={setRecibosDobles} disabled={uploadingRecibo} />
                        <div>
                          <label htmlFor="monto-dos-recibos" className="block text-xs font-medium text-gray-700">
                            Monto total del pago (los dos recibos juntos) <span className="text-red-500">*</span>
                          </label>
                          <input id="monto-dos-recibos" type="text" inputMode="numeric" value={montoManual}
                            onChange={e => { const d = e.target.value.replace(/[^0-9]/g, ''); setMontoManual(d ? Number(d).toLocaleString('es-CO') : '') }}
                            placeholder="Ej: 110.000"
                            className="mt-1 w-48 px-3 py-2 border border-gray-300 rounded-md text-sm tabular-nums" />
                          {pagoInscripcion != null && (
                            <p className="text-xs text-gray-500 mt-1">Valor de inscripción del contrato: {fmtPesos(pagoInscripcion)}</p>
                          )}
                          {difiereInscripcion && (
                            <p className="text-xs font-medium text-amber-700 mt-1">
                              El monto digitado no coincide con el valor de inscripción del contrato. Puedes guardar igual, pero revísalo.
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <button type="button" onClick={guardarDosRecibos}
                            disabled={uploadingRecibo || !recibosDobles[0] || !recibosDobles[1] || montoNum <= 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                            <Upload className="w-3.5 h-3.5" /> {uploadingRecibo ? 'Guardando…' : (reciboData ? 'Reemplazar con los dos recibos' : 'Guardar los dos recibos')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {reciboData?.dosRecibos && Array.isArray(reciboData.recibos) ? (
                  <div className="border border-emerald-100 bg-emerald-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Dos recibos</span>
                      <span className="text-sm text-gray-800">Monto total digitado: <strong>{fmtPesos(Number(reciboData.montoManual) || 0)}</strong></span>
                    </div>
                    {reciboData.recibos.map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" title={`Ver recibo ${i + 1}`} className="shrink-0">
                          {esImagen(r.tipo, r.url) ? (
                            <img src={r.url} alt={r.nombre || `recibo ${i + 1}`} className="h-12 w-12 rounded object-cover border border-emerald-200 hover:ring-2 hover:ring-emerald-300" />
                          ) : (
                            <span className="h-12 w-12 rounded bg-white border border-emerald-200 flex items-center justify-center"><Receipt className="w-5 h-5 text-emerald-500" /></span>
                          )}
                        </a>
                        <div className="min-w-0 text-sm">
                          <span className="text-xs font-semibold text-gray-600">Recibo {i + 1}</span>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="block text-emerald-700 font-medium hover:underline break-all">{r.nombre || `Recibo ${i + 1}`}</a>
                          {r.extraido && (r.extraido.monto || r.extraido.fecha) && (
                            <div className="text-xs text-gray-600">
                              {r.extraido.monto && <span>Leído: ${Number(r.extraido.monto).toLocaleString('es-CO')} · </span>}
                              {r.extraido.fecha && <span>{r.extraido.fecha}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : reciboData ? (
                  <div className="flex items-center gap-3 border border-emerald-100 bg-emerald-50 rounded-lg p-3">
                    <a href={reciboData.url} target="_blank" rel="noopener noreferrer" title="Ver recibo" className="shrink-0">
                      {esImagen(reciboData.tipo, reciboData.url) ? (
                        <img src={reciboData.url} alt={reciboData.nombre || 'recibo'} className="h-14 w-14 rounded object-cover border border-emerald-200 hover:ring-2 hover:ring-emerald-300" />
                      ) : (
                        <span className="h-14 w-14 rounded bg-white border border-emerald-200 flex items-center justify-center"><Receipt className="w-6 h-6 text-emerald-500" /></span>
                      )}
                    </a>
                    <div className="min-w-0 text-sm">
                      <a href={reciboData.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-medium hover:underline break-all">{reciboData.nombre || 'Recibo'}</a>
                      <div className="mt-0.5"><a href={reciboData.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Ver recibo</a></div>
                      {reciboData.extraido && (
                        <div className="text-xs text-gray-600 mt-1">
                          {reciboData.extraido.medioPago && <span>{reciboData.extraido.medioPago} · </span>}
                          {reciboData.extraido.monto && <span>${Number(reciboData.extraido.monto).toLocaleString('es-CO')} · </span>}
                          {reciboData.extraido.fecha && <span>{reciboData.extraido.fecha}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg p-4 text-center">Sin recibo aún.</div>
                )}
              </section>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
