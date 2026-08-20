'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Datos "kids" adicionales de un beneficiario (curso + apoderado). El catálogo
 * Campaña/Tipo/Horario es placeholder hasta conectar KIDS2026.
 */
export interface KidsData {
  titularEsApoderado?: boolean
  campaign?: string
  tipoCurso?: string // 'JUNIOR' | 'YOUNGSTER' (enum de KIDS2026)
  horario?: string
  apoderado?: string
  apoderadoTelefono?: string
  apoderadoMail?: string
}

/**
 * El modal reúne TODO el beneficiario kid: sus datos regulares (idénticos a un
 * beneficiario normal) + los adicionales de kids. Al activar el switch Kids la
 * fila del wizard colapsa a un resumen y la captura completa pasa aquí.
 */
export interface KidsBeneficiarioValue {
  primerNombre?: string
  segundoNombre?: string
  primerApellido?: string
  segundoApellido?: string
  numeroId?: string
  fechaNacimiento?: string
  email?: string
  celular?: string
  kidsData?: KidsData
}

const TIPOS_CURSO = ['JUNIOR', 'YOUNGSTER'] as const
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  open: boolean
  initial?: KidsBeneficiarioValue
  /** Datos del titular para el atajo "¿El titular será el apoderado?". */
  titularNombre?: string
  titularCelular?: string
  titularEmail?: string
  onSave: (value: KidsBeneficiarioValue) => void
  onCancel: () => void
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500'

export default function KidsBeneficiarioModal({
  open, initial, titularNombre, titularCelular, titularEmail, onSave, onCancel,
}: Props) {
  const [form, setForm] = useState<KidsBeneficiarioValue>({})
  const [kids, setKids] = useState<KidsData>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm({ ...(initial || {}) })
      setKids({ ...(initial?.kidsData || {}) })
      setError(null)
    }
  }, [open, initial])

  if (!open) return null

  const setF = (k: keyof KidsBeneficiarioValue, v: any) => setForm(d => ({ ...d, [k]: v }))
  const setK = (k: keyof KidsData, v: any) => setKids(d => ({ ...d, [k]: v }))

  const toggleTitularApoderado = (checked: boolean) => {
    if (checked) {
      setKids(d => ({
        ...d,
        titularEsApoderado: true,
        apoderado: titularNombre || d.apoderado || '',
        apoderadoTelefono: titularCelular || d.apoderadoTelefono || '',
        apoderadoMail: titularEmail || d.apoderadoMail || '',
      }))
    } else {
      setKids(d => ({ ...d, titularEsApoderado: false }))
    }
  }

  const apoderadoLocked = kids.titularEsApoderado === true

  const guardar = () => {
    // Requeridos básicos del beneficiario (igual que el wizard regular).
    if (!form.primerNombre?.trim() || !form.primerApellido?.trim()) {
      setError('El primer nombre y el primer apellido son obligatorios'); return
    }
    if (!form.numeroId?.trim()) { setError('El número de identificación es obligatorio'); return }
    if (!form.email?.trim() || !emailRe.test(form.email.trim())) {
      setError('El correo no es válido (debe contener @ y dominio, sin espacios)'); return
    }
    onSave({ ...form, kidsData: kids })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Beneficiario Kids <span className="ml-2 align-middle inline-block bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full">🧒 KIDS</span>
            </h2>
            <p className="text-sm text-gray-500">Datos del beneficiario, curso y apoderado</p>
          </div>
          <button type="button" onClick={onCancel} title="Cancelar" className="text-gray-400 hover:text-gray-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}

          {/* Datos del beneficiario (idénticos a un beneficiario regular) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">Datos del beneficiario</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Primer nombre" required><input value={form.primerNombre || ''} onChange={e => setF('primerNombre', e.target.value)} className={inputCls} /></Field>
              <Field label="Segundo nombre"><input value={form.segundoNombre || ''} onChange={e => setF('segundoNombre', e.target.value)} className={inputCls} /></Field>
              <Field label="Primer apellido" required><input value={form.primerApellido || ''} onChange={e => setF('primerApellido', e.target.value)} className={inputCls} /></Field>
              <Field label="Segundo apellido"><input value={form.segundoApellido || ''} onChange={e => setF('segundoApellido', e.target.value)} className={inputCls} /></Field>
              <Field label="N° identificación" required><input value={form.numeroId || ''} onChange={e => setF('numeroId', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className={`${inputCls} font-mono`} /></Field>
              <Field label="Fecha de nacimiento"><input type="date" value={form.fechaNacimiento || ''} onChange={e => setF('fechaNacimiento', e.target.value)} className={inputCls} /></Field>
              <Field label="Email" required><input value={form.email || ''} onChange={e => setF('email', e.target.value.replace(/\s/g, ''))} className={`${inputCls} font-mono`} placeholder="correo@dominio.com" /></Field>
              <Field label="Celular" required><input value={form.celular || ''} onChange={e => setF('celular', e.target.value.replace(/\D/g, ''))} className={inputCls} placeholder="Solo dígitos" /></Field>
            </div>
          </div>

          {/* Curso — adicional kids (catálogo KIDS2026, placeholder) */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-1"><span className="text-primary-600">＋</span> Curso <span className="normal-case font-normal text-gray-400">(adicional Kids)</span></h3>
            <p className="text-xs text-gray-400 mb-3">El catálogo (campaña, curso, horario) se conectará a KIDS2026 cuando esté disponible.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Campaña"><input value={kids.campaign || ''} onChange={e => setK('campaign', e.target.value)} className={inputCls} /></Field>
              <Field label="Tipo de curso">
                <select value={kids.tipoCurso || ''} onChange={e => setK('tipoCurso', e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="">— Selecciona —</option>
                  {TIPOS_CURSO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Horario"><input value={kids.horario || ''} onChange={e => setK('horario', e.target.value)} className={inputCls} /></Field></div>
            </div>
          </div>

          {/* Apoderado — adicional kids */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3"><span className="text-primary-600">＋</span> Apoderado <span className="normal-case font-normal text-gray-400">(adicional Kids)</span></h3>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={kids.titularEsApoderado === true} onChange={e => toggleTitularApoderado(e.target.checked)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
              <span className="text-sm text-gray-800">¿El titular será el apoderado?</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Field label="Nombre del apoderado"><input value={kids.apoderado || ''} disabled={apoderadoLocked} onChange={e => setK('apoderado', e.target.value)} className={`${inputCls} disabled:bg-gray-100`} /></Field></div>
              <Field label="Teléfono"><input value={kids.apoderadoTelefono || ''} disabled={apoderadoLocked} onChange={e => setK('apoderadoTelefono', e.target.value.replace(/\D/g, ''))} className={`${inputCls} disabled:bg-gray-100`} placeholder="Solo dígitos" /></Field>
              <Field label="Correo"><input value={kids.apoderadoMail || ''} disabled={apoderadoLocked} onChange={e => setK('apoderadoMail', e.target.value.replace(/\s/g, ''))} className={`${inputCls} disabled:bg-gray-100 font-mono`} placeholder="correo@dominio.com" /></Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={guardar} className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700">Guardar beneficiario Kids</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
    </div>
  )
}
