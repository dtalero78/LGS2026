'use client'

import { useState } from 'react'

const PAISES = [
  'Colombia', 'Mexico', 'Argentina', 'Chile', 'Peru', 'Ecuador', 'Venezuela',
  'Bolivia', 'Paraguay', 'Uruguay', 'Costa Rica', 'Panama', 'Guatemala',
  'Honduras', 'El Salvador', 'Nicaragua', 'Republica Dominicana', 'Cuba',
  'Puerto Rico', 'Espana', 'Estados Unidos', 'Brasil', 'Otro'
]

interface FormData {
  primerNombre: string
  primerApellido: string
  numberid: string
  email: string
  clave: string
  telefono: string
  pais: string
  zoom: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

export default function NuevoAdvisorPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    primerNombre: '',
    primerApellido: '',
    numberid: '',
    email: '',
    clave: '',
    telefono: '',
    pais: '',
    zoom: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const updateField = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev }
        delete copy[field]
        return copy
      })
    }
  }

  const validateStep = (currentStep: number): boolean => {
    const newErrors: FormErrors = {}

    if (currentStep === 1) {
      if (!form.primerNombre.trim()) newErrors.primerNombre = 'Requerido'
      if (!form.primerApellido.trim()) newErrors.primerApellido = 'Requerido'
    }

    if (currentStep === 2) {
      if (!form.email.trim()) newErrors.email = 'Requerido'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Email no valido'
      if (!form.clave.trim()) newErrors.clave = 'Requerido'
      else if (form.clave.trim().length < 4) newErrors.clave = 'Minimo 4 caracteres'
      if (!form.telefono.trim()) newErrors.telefono = 'Requerido'
      if (!form.pais) newErrors.pais = 'Requerido'
    }

    if (currentStep === 3) {
      if (!form.zoom.trim()) newErrors.zoom = 'Requerido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1)
      window.scrollTo(0, 0)
    }
  }

  const handleBack = () => {
    setStep(prev => prev - 1)
    window.scrollTo(0, 0)
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) return

    setSubmitting(true)
    setApiError(null)

    try {
      const res = await fetch('/api/postgres/advisors/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al crear el registro')
      }

      setDone(true)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registro Creado</h2>
          <p className="text-gray-600 mb-1">Tu cuenta de advisor ha sido creada exitosamente.</p>
          <p className="text-sm text-gray-500">Puedes cerrar esta pagina.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 text-white">
          <h1 className="text-xl font-bold">Registro de Advisor</h1>
          <p className="text-indigo-200 text-sm mt-1">Let&apos;s Go Speak</p>
        </div>

        {/* Progress */}
        <div className="px-6 pt-5">
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${s < step ? 'bg-green-500 text-white' : s === step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}
                `}>
                  {s < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 rounded ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-1">
            Paso {step} de 3 &mdash; {step === 1 ? 'Datos Basicos' : step === 2 ? 'Contacto' : 'Zoom'}
          </p>
        </div>

        {/* Form */}
        <div className="px-6 pb-6 pt-2">
          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {apiError}
            </div>
          )}

          {/* Step 1: Datos Basicos */}
          {step === 1 && (
            <div className="space-y-4">
              <Field
                label="Nombres"
                value={form.primerNombre}
                onChange={v => updateField('primerNombre', v)}
                error={errors.primerNombre}
                placeholder="Ej: Juan Carlos"
                required
              />
              <Field
                label="Apellidos"
                value={form.primerApellido}
                onChange={v => updateField('primerApellido', v)}
                error={errors.primerApellido}
                placeholder="Ej: Perez Garcia"
                required
              />
            </div>
          )}

          {/* Step 2: Contacto */}
          {step === 2 && (
            <div className="space-y-4">
              <Field
                label="Email"
                value={form.email}
                onChange={v => updateField('email', v)}
                error={errors.email}
                placeholder="advisor@email.com"
                type="email"
                required
              />
              <Field
                label="Contrasena"
                value={form.clave}
                onChange={v => updateField('clave', v)}
                error={errors.clave}
                placeholder="Minimo 4 caracteres"
                type="password"
                required
              />
              <Field
                label="Telefono"
                value={form.telefono}
                onChange={v => updateField('telefono', v)}
                error={errors.telefono}
                placeholder="Ej: 3001234567"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pais <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.pais}
                  onChange={e => updateField('pais', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.pais ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Seleccionar pais</option>
                  {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {errors.pais && <p className="text-red-500 text-xs mt-1">{errors.pais}</p>}
              </div>
            </div>
          )}

          {/* Step 3: Zoom */}
          {step === 3 && (
            <div className="space-y-4">
              <Field
                label="Link de Zoom"
                value={form.zoom}
                onChange={v => updateField('zoom', v)}
                error={errors.zoom}
                placeholder="https://zoom.us/j/..."
                required
              />

              {/* Summary */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Resumen</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Nombre:</span> {form.primerNombre} {form.primerApellido}</p>
                  <p><span className="font-medium">Email:</span> {form.email}</p>
                  <p><span className="font-medium">Telefono:</span> {form.telefono}</p>
                  <p><span className="font-medium">Pais:</span> {form.pais}</p>
                  <p><span className="font-medium">Zoom:</span> {form.zoom}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Atras
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creando...' : 'Crear Registro'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, error, placeholder, type = 'text', required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
