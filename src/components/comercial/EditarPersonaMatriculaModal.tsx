'use client'

/**
 * Modal del botón "Editar" del Resumen de Matrícula (/dashboard/comercial/matriculas/[id]).
 *
 *  - modo 'corregir': formulario precargado; guarda solo lo que cambia y lo propaga
 *    a todas las tablas (POST /api/postgres/matriculas/[id]/editar → actualizarPersona).
 *    Nombre y documento exigen además PERSON.INFO.EDITAR_NOMBRE / EDITAR_NUMERO_ID.
 *  - modo 'reemplazar': formulario vacío + motivo + confirmación. Titular o
 *    beneficiario sin aprobar → se sobrescribe y se anula la firma; beneficiario
 *    aprobado → se crea el nuevo (SIN APROBAR) y el anterior queda inactivo.
 *
 * Si el documento aparece en otro contrato vivo (pendiente o como titular), el
 * servidor devuelve avisos y pide confirmar.
 */

import { useState } from 'react'
import toast from 'react-hot-toast'
import { X, AlertTriangle, Lock } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { PersonPermission } from '@/types/permissions'
import CambioContratoModal, { type CambioContrato } from '@/components/common/CambioContratoModal'

export type ModoEdicion = 'corregir' | 'reemplazar'

interface Props {
  persona: any
  esTitular: boolean
  modo: ModoEdicion
  /** Contrato firmado (hashConsentimiento). */
  firmado: boolean
  onClose: () => void
  onSaved: () => void
  /** _id del titular del contrato (enlace "Ir al contrato" del aviso de cambio). */
  titularId?: string | null
}

const CAMPOS_IDENTIDAD = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido', 'numeroId', 'fechaNacimiento', 'genero']
const CAMPOS_NOMBRE = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido']

const fechaInput = (v: any): string => {
  if (!v) return ''
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

export default function EditarPersonaMatriculaModal({ persona, esTitular, modo, firmado, onClose, onSaved, titularId }: Props) {
  // Tras un reemplazo: aviso con el resumen (el servidor regenera el PDF del contrato).
  const [cambio, setCambio] = useState<CambioContrato | null>(null)
  const { hasPermission } = usePermissions()
  const canNombre = modo === 'reemplazar' || hasPermission(PersonPermission.EDITAR_NOMBRE)
  const canDoc = modo === 'reemplazar' || hasPermission(PersonPermission.EDITAR_NUMERO_ID)
  const aprobado = String(persona?.aprobacion || '').toUpperCase().startsWith('APROBAD')
  const reemplazoHistorico = modo === 'reemplazar' && !esTitular && aprobado

  const inicial = (k: string) => modo === 'reemplazar' ? '' : (k === 'fechaNacimiento' ? fechaInput(persona?.[k]) : String(persona?.[k] ?? ''))
  const campos = [
    ...CAMPOS_IDENTIDAD, 'celular', 'telefono', 'email', 'domicilio', 'ciudad',
    ...(esTitular ? ['cargo', 'empresa', 'ingresos'] : []),
  ]
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(campos.map(k => [k, inicial(k)])))
  const [motivo, setMotivo] = useState('')
  const [confirmo, setConfirmo] = useState(false)
  const [avisos, setAvisos] = useState<any[] | null>(null)
  const [guardando, setGuardando] = useState(false)

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setAvisos(null) }
  const bloqueado = (k: string) => (CAMPOS_NOMBRE.includes(k) && !canNombre) || (k === 'numeroId' && !canDoc)

  const nombreActual = [persona?.primerNombre, persona?.primerApellido].filter(Boolean).join(' ')

  const guardar = async (confirmarAvisos = false) => {
    if (modo === 'reemplazar') {
      if (!form.primerNombre.trim() || !form.primerApellido.trim()) return toast.error('Nombre y apellido son obligatorios')
      if (!form.numeroId.trim()) return toast.error('El número de documento es obligatorio')
      if (!form.celular.trim()) return toast.error('El celular es obligatorio')
      if (motivo.trim().length < 10) return toast.error('Indica el motivo (mínimo 10 caracteres)')
      if (!confirmo) return toast.error('Marca la casilla de confirmación')
    }
    // Corregir: solo se mandan los campos permitidos (los bloqueados no viajan).
    const datos = Object.fromEntries(Object.entries(form).filter(([k]) => !bloqueado(k)))
    setGuardando(true)
    try {
      const r = await fetch(`/api/postgres/matriculas/${persona._id}/editar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo, datos, motivo, confirmarAvisos }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.success === false) { toast.error(j?.error || 'No se pudo guardar'); return }
      const d = j.data ?? j
      if (d.requiereConfirmacion) { setAvisos(d.avisos || []); return }
      if (d.aviso) toast(d.aviso, { icon: '⚠️', duration: 9000 })
      if (modo === 'corregir') toast.success(d.corregidoTrasFirma ? 'Datos corregidos (quedó la marca de corrección después de la firma)' : 'Datos corregidos')
      else if (d.tipo === 'BENEFICIARIO_APROBADO') toast.success('Nuevo beneficiario creado (sin aprobar). Apruébelo desde la ficha.')
      else toast.success(d.firmaAnulada ? 'Persona reemplazada. La firma se anuló: solicite una firma nueva.' : 'Persona reemplazada')
      if (modo === 'reemplazar' && d.pdfRegenerado) {
        setCambio({
          titulo: esTitular ? 'Titular reemplazado' : 'Beneficiario reemplazado',
          resumen: `${d.resumen || ''} Motivo: ${motivo.trim()}`.trim(),
          contrato: persona?.contrato, titularId: esTitular ? persona._id : (titularId || persona?.titularId || null),
          firmaAnulada: !!d.firmaAnulada,
        })
        return
      }
      onSaved()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const input = (k: string, label: string, opts: { type?: string; full?: boolean } = {}) => (
    <label className={`block ${opts.full ? 'sm:col-span-2' : ''}`}>
      <span className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-1">
        {label}{bloqueado(k) && <Lock className="h-3 w-3" aria-label="Sin permiso" />}
      </span>
      <input
        type={opts.type || 'text'} value={form[k] ?? ''} disabled={bloqueado(k) || guardando}
        onChange={e => set(k, e.target.value)}
        title={bloqueado(k) ? 'No tienes permiso para cambiar este campo' : undefined}
        className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500"
      />
    </label>
  )

  const titulo = modo === 'corregir'
    ? `Corregir datos — ${esTitular ? 'Titular' : 'Beneficiario'}`
    : `Reemplazar ${esTitular ? 'titular' : 'beneficiario'}`

  if (cambio) return <CambioContratoModal cambio={cambio} onClose={() => { setCambio(null); onSaved() }} />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className={`px-5 py-3 rounded-t-xl flex items-center justify-between text-white ${modo === 'corregir' ? 'bg-indigo-600' : 'bg-red-600'}`}>
          <div>
            <div className="font-bold">{titulo}</div>
            <div className="text-xs opacity-90">{modo === 'corregir' ? nombreActual : `Reemplaza a: ${nombreActual} · ID ${persona?.numeroId || '—'}`}</div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/20" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {modo === 'corregir' && firmado && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs">
              El contrato ya está firmado. Corregir el contacto no afecta la firma; si corriges nombre, documento,
              fecha de nacimiento o género, la firma se conserva pero queda la marca <b>«Datos corregidos después de la firma»</b>.
            </div>
          )}
          {modo === 'reemplazar' && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Reemplazo de persona</div>
              {reemplazoHistorico ? (
                <p>{nombreActual} está aprobado: <b>no se borra</b>. Se inactiva (clases futuras, ficha académica y login) y queda como histórico.
                  El nuevo beneficiario entra al mismo contrato como <b>SIN APROBAR</b> y se aprueba desde la ficha, como siempre.</p>
              ) : (
                <p>Se sobrescriben los datos de {nombreActual} con los de la persona nueva. Pagos, financieros, documentación y referencias se conservan.
                  {esTitular && firmado ? <> <b>La firma del contrato se anula</b>: habrá que solicitar una firma nueva.</> : null}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {input('primerNombre', 'Primer nombre *')}
            {input('segundoNombre', 'Segundo nombre')}
            {input('primerApellido', 'Primer apellido *')}
            {input('segundoApellido', 'Segundo apellido')}
            {input('numeroId', 'N° de documento *')}
            {input('fechaNacimiento', 'Fecha de nacimiento', { type: 'date' })}
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-gray-500">Género</span>
              <select value={form.genero || ''} onChange={e => set('genero', e.target.value)} disabled={guardando}
                className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm">
                <option value="">—</option>
                <option>Masculino</option><option>Femenino</option><option>Otro</option>
              </select>
            </label>
            {input('celular', `Celular${modo === 'reemplazar' ? ' *' : ''}`)}
            {input('telefono', 'Teléfono')}
            {input('email', 'Email', { type: 'email' })}
            {input('domicilio', 'Domicilio', { full: true })}
            {input('ciudad', 'Ciudad')}
            {esTitular && <>
              {input('cargo', 'Cargo')}
              {input('empresa', 'Empresa')}
              {input('ingresos', 'Ingresos')}
            </>}
          </div>

          {modo === 'reemplazar' && (
            <div className="space-y-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-gray-500">Motivo del reemplazo * (mín. 10)</span>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} disabled={guardando}
                  className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="flex items-start gap-2 text-xs text-red-800">
                <input type="checkbox" checked={confirmo} onChange={e => setConfirmo(e.target.checked)} className="mt-0.5" />
                Confirmo que {nombreActual} será reemplazado{reemplazoHistorico ? ' e inactivado' : ''} en el contrato {persona?.contrato}.
              </label>
            </div>
          )}

          {avisos && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-300 p-3 text-xs text-yellow-900 space-y-1">
              <div className="font-semibold">El documento {form.numeroId} aparece en otros contratos vivos:</div>
              <ul className="list-disc pl-5">
                {avisos.map((a, i) => (
                  <li key={i}>
                    {a.nombre || 'sin nombre'} — {a.rol === 'TITULAR' ? 'titular' : 'beneficiario'} del contrato{' '}
                    {a.titularId ? <a className="underline" href={`/person/${a.titularId}`} target="_blank" rel="noopener noreferrer">{a.contrato}</a> : a.contrato}
                    {' '}({a.situacion === 'APROBADO' ? 'aprobado' : a.situacion === 'FIRMADO_SIN_APROBAR' ? 'firmado sin aprobar' : 'sin firmar'})
                  </li>
                ))}
              </ul>
              <div>¿Deseas continuar de todas formas?</div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={guardando} className="px-4 py-1.5 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={() => guardar(!!avisos)} disabled={guardando}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${modo === 'corregir' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {guardando ? 'Guardando…' : avisos ? 'Confirmar y guardar' : modo === 'corregir' ? 'Guardar corrección' : 'Reemplazar'}
          </button>
        </div>
      </div>
    </div>
  )
}
