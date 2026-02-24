'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

type PageState = 'LOADING' | 'ERROR' | 'ALREADY_REGISTERED' | 'FORM' | 'SUCCESS'

interface WelcomeEvent {
  _id: string
  dia: string
  hora: string
  advisor: string
  linkZoom: string
  limiteUsuarios: number
  inscritos: number
  lleno: boolean
}

interface StudentData {
  _id: string
  primerNombre: string
  segundoNombre: string
  primerApellido: string
  segundoApellido: string
  email: string
  celular: string
  nivel: string
  plataforma: string
  foto: string
}

function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatEventDate(dia: string) {
  const fecha = new Date(dia)
  if (isNaN(fecha.getTime())) return 'Fecha no válida'
  const diaNombre = fecha.toLocaleString('es-ES', { weekday: 'long' })
  const diaNumero = fecha.getDate()
  const mes = fecha.toLocaleString('es-ES', { month: 'long' })
  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${capitalizeFirstLetter(diaNombre)} ${diaNumero} de ${mes} - ${hora}`
}

export default function NuevoUsuarioPage() {
  const params = useParams()
  const academicId = params.id as string

  const [pageState, setPageState] = useState<PageState>('LOADING')
  const [error, setError] = useState('')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [welcomeEvents, setWelcomeEvents] = useState<WelcomeEvent[]>([])
  const [hasWelcomeBooking, setHasWelcomeBooking] = useState(false)

  // Form fields
  const [detallesPersonales, setDetallesPersonales] = useState('')
  const [hobbies, setHobbies] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [fotoPreview, setFotoPreview] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadData = useCallback(async () => {
    try {
      setPageState('LOADING')
      const res = await fetch(`/api/nuevo-usuario/${academicId}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Error cargando datos')
        setPageState('ERROR')
        return
      }

      setStudent(data.student)
      setWelcomeEvents(data.welcomeEvents || [])
      setHasWelcomeBooking(data.hasWelcomeBooking)

      if (data.student.email) setEmail(data.student.email)
      if (data.student.foto) {
        setFotoUrl(data.student.foto)
        setFotoPreview(data.student.foto)
      }

      if (data.alreadyRegistered) {
        setPageState('ALREADY_REGISTERED')
      } else {
        setPageState('FORM')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setPageState('ERROR')
    }
  }, [academicId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onloadend = () => setFotoPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Upload
    setUploadingPhoto(true)
    setFormError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/nuevo-usuario/${academicId}/upload-photo`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFotoUrl(data.publicUrl)
      } else {
        setFormError(data.error || 'Error subiendo la foto')
        setFotoPreview('')
      }
    } catch {
      setFormError('Error subiendo la foto. Intenta de nuevo.')
      setFotoPreview('')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    // Client-side validation
    if (!detallesPersonales.trim()) { setFormError('Por favor escribe algo sobre ti'); return }
    if (!hobbies.trim()) { setFormError('Por favor escribe tus hobbies'); return }
    if (!email.trim()) { setFormError('Por favor ingresa tu email o nombre de usuario'); return }
    if (!clave.trim()) { setFormError('Por favor crea una clave'); return }

    // If nivel is WELCOME and no event selected and events are available
    if (student?.nivel === 'WELCOME' && !hasWelcomeBooking && welcomeEvents.length > 0 && !selectedEvent) {
      setFormError('Por favor selecciona una fecha para tu sesión Welcome')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/nuevo-usuario/${academicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detallesPersonales: detallesPersonales.trim(),
          hobbies: hobbies.trim(),
          email: email.trim(),
          clave: clave.trim(),
          foto: fotoUrl || null,
          welcomeEventId: selectedEvent || null,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setPageState('SUCCESS')
      } else {
        setFormError(data.error || 'Error al completar el registro')
      }
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── LOADING ───
  if (pageState === 'LOADING') {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-500">Cargando tu información...</p>
        </div>
      </PageShell>
    )
  }

  // ─── ERROR ───
  if (pageState === 'ERROR') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Intentar de nuevo
          </button>
        </div>
      </PageShell>
    )
  }

  // ─── ALREADY REGISTERED ───
  if (pageState === 'ALREADY_REGISTERED') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-green-500 text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Ya estás registrado!</h2>
          <p className="text-gray-600 mb-4">
            {student?.primerNombre}, tu registro ya fue completado anteriormente.
          </p>
          <p className="text-gray-500 text-sm">
            Si tienes alguna pregunta, contacta a tu asesor.
          </p>
        </div>
      </PageShell>
    )
  }

  // ─── SUCCESS ───
  if (pageState === 'SUCCESS') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-green-500 text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ¡Registro completado!
          </h2>
          <p className="text-gray-600 mb-4">
            {student?.primerNombre}, te esperamos en tu sesión Welcome.
          </p>
          <p className="text-gray-500 text-sm">
            Pronto recibirás más información por WhatsApp.
          </p>
        </div>
      </PageShell>
    )
  }

  // ─── FORM ───
  return (
    <PageShell>
      <div className="max-w-lg mx-auto">
        {/* Welcome message */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {student?.primerNombre}, ¡te estábamos esperando!
          </h1>
          <p className="text-gray-500">
            Completa tu perfil para comenzar tu experiencia con Let&apos;s Go Speak
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Detalles Personales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cuéntanos sobre ti
            </label>
            <textarea
              value={detallesPersonales}
              onChange={e => setDetallesPersonales(e.target.value)}
              placeholder="¿Qué te motivó a aprender inglés? ¿En qué trabajas?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Hobbies */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hobbies e intereses
            </label>
            <textarea
              value={hobbies}
              onChange={e => setHobbies(e.target.value)}
              placeholder="¿Qué te gusta hacer en tu tiempo libre?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Email / Usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email o nombre de usuario
            </label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Clave */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Crea una clave
            </label>
            <input
              type="password"
              value={clave}
              onChange={e => setClave(e.target.value)}
              placeholder="Tu clave para acceder a la plataforma"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tu foto <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="flex items-center gap-4">
              {fotoPreview ? (
                <img
                  src={fotoPreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-gray-400 text-2xl">📷</span>
                </div>
              )}
              <div className="flex-1">
                <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {uploadingPhoto ? 'Subiendo...' : fotoPreview ? 'Cambiar foto' : 'Subir foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG o WEBP. Máx 10MB</p>
              </div>
            </div>
          </div>

          {/* Welcome Session Dropdown */}
          {student?.nivel === 'WELCOME' && !hasWelcomeBooking && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agenda tu sesión Welcome
              </label>
              {welcomeEvents.length > 0 ? (
                <select
                  value={selectedEvent}
                  onChange={e => setSelectedEvent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Selecciona una fecha...</option>
                  {welcomeEvents.map(event => (
                    <option
                      key={event._id}
                      value={event._id}
                      disabled={event.lleno}
                    >
                      {formatEventDate(event.dia)}{event.lleno ? ' (LLENO)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No hay sesiones Welcome disponibles en este momento.
                </p>
              )}
            </div>
          )}

          {student?.nivel === 'WELCOME' && hasWelcomeBooking && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-700 text-sm font-medium">
                ✅ Ya tienes una sesión Welcome agendada
              </p>
            </div>
          )}

          {/* Error message */}
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{formError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || uploadingPhoto}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Guardando...' : 'Completar registro'}
          </button>
        </form>
      </div>
    </PageShell>
  )
}

// ─── PageShell: Simple layout for public pages ───
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            LGS
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Let&apos;s Go Speak</h1>
            <p className="text-xs text-gray-500">Registro de nuevo usuario</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          Let&apos;s Go Speak &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  )
}
