'use client'

import { useEffect, useState } from 'react'
import { FileText, Upload, Receipt, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [docsList, setDocsList] = useState<any[]>([])
  const [reciboData, setReciboData] = useState<any | null>(null)
  const [reciboActive, setReciboActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadingRecibo, setUploadingRecibo] = useState(false)

  useEffect(() => {
    if (!open || !personId) return
    setDocsList([]); setReciboData(null); setReciboActive(false); setLoading(true)
    Promise.all([
      fetch(`/api/contracts/${personId}/documents`).then(x => x.json()).catch(() => null),
      fetch(`/api/contracts/${personId}/recibo-inscripcion`).then(x => x.json()).catch(() => null),
    ]).then(([d, r]) => {
      if (d?.success) setDocsList(d.documentacion || [])
      if (r?.success) { setReciboData(r.recibo || null); setReciboActive(!!r.active) }
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
                  <button type="button" onClick={() => pickFiles(true, uploadDocs)} disabled={uploadingDoc}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                    <Upload className="w-3.5 h-3.5" /> {uploadingDoc ? 'Subiendo…' : 'Subir documentos'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">Documentos requeridos para la aprobación (imágenes o PDF). El recibo de pago va en la sección de abajo.</p>
                {docsList.length === 0 ? (
                  <div className="text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg p-4 text-center">Sin documentos aún.</div>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                    {docsList.map((d: any, i: number) => (
                      <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate max-w-[75%]">{d.nombre || 'Documento'}</a>
                        <button type="button" onClick={() => deleteDoc(d.url, d.nombre || 'documento')} title="Eliminar" className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Recibo de inscripción */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-emerald-600" /> Recibo de inscripción</h4>
                  {reciboActive && (
                    <button type="button" onClick={() => pickFiles(false, fs => { if (fs[0]) uploadRecibo(fs[0]) })} disabled={uploadingRecibo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                      <Upload className="w-3.5 h-3.5" /> {uploadingRecibo ? 'Subiendo…' : (reciboData ? 'Reemplazar recibo' : 'Subir recibo')}
                    </button>
                  )}
                </div>
                {!reciboActive && !reciboData && (
                  <p className="text-xs text-amber-600 mb-2">La subida del recibo no está habilitada para tu usuario (requiere el permiso «Subir recibo» o que la lectura de recibos esté activa).</p>
                )}
                {reciboData ? (
                  <div className="text-sm border border-emerald-100 bg-emerald-50 rounded-lg p-3">
                    <a href={reciboData.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-medium hover:underline break-all">{reciboData.nombre || 'Recibo'}</a>
                    {reciboData.extraido && (
                      <div className="text-xs text-gray-600 mt-1">
                        {reciboData.extraido.medioPago && <span>{reciboData.extraido.medioPago} · </span>}
                        {reciboData.extraido.monto && <span>${Number(reciboData.extraido.monto).toLocaleString('es-CO')} · </span>}
                        {reciboData.extraido.fecha && <span>{reciboData.extraido.fecha}</span>}
                      </div>
                    )}
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
