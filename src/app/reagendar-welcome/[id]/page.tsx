'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

type PageState = 'LOADING' | 'ERROR' | 'NOT_WELCOME' | 'FORM' | 'SUCCESS'

interface WelcomeEvent {
  _id: string
  dia: string
  lleno: boolean
}

interface StudentData {
  _id: string
  primerNombre: string
  primerApellido: string
  email: string
  nivel: string
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

export default function ReagendarWelcomePage() {
  const params = useParams()
  const academicId = params.id as string

  const [pageState, setPageState] = useState<PageState>('LOADING')
  const [error, setError] = useState('')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [welcomeEvents, setWelcomeEvents] = useState<WelcomeEvent[]>([])
  const [hasWelcomeBooking, setHasWelcomeBooking] = useState(false)

  const [selectedEvent, setSelectedEvent] = useState('')
  const [fotoPreview, setFotoPreview] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadData = useCallback(async () => {
    setPageState('LOADING')
    setError('')
    try {
      // Reutiliza el GET del registro: devuelve student + welcomeEvents + hasWelcomeBooking
      const res = await fetch(`/api/nuevo-usuario/${academicId}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`)
      setStudent(data.student)
      setWelcomeEvents(data.welcomeEvents || [])
      setHasWelcomeBooking(!!data.hasWelcomeBooking)
      if (data.student?.foto) setFotoPreview(data.student.foto)
      if (data.student?.nivel !== 'WELCOME') {
        setPageState('NOT_WELCOME')
      } else {
        setPageState('FORM')
      }
    } catch (e: any) {
      setError(e?.message || 'Error de conexión. Intenta de nuevo.')
      setPageState('ERROR')
    }
  }, [academicId])

  useEffect(() => { loadData() }, [loadData])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setFotoPreview(reader.result as string)
    reader.readAsDataURL(file)

    setUploadingPhoto(true)
    setFormError('')
    try {
      const presignRes = await fetch('/api/nuevo-usuario/photo-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicaId: academicId, contentType: file.type }),
      })
      const presignData = await presignRes.json()
      if (!presignData.success) throw new Error(presignData.error || 'Error al generar URL')
      const uploadRes = await fetch(presignData.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('Error al subir la foto')
      setFotoUrl(presignData.publicUrl)
    } catch (err: any) {
      setFormError(err.message || 'Error subiendo la foto. Intenta de nuevo.')
      setFotoPreview(student?.foto || '')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!selectedEvent) {
      setFormError('Por favor selecciona una fecha para tu sesión Welcome')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/reagendar-welcome/${academicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          welcomeEventId: selectedEvent,
          foto: fotoUrl || null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPageState('SUCCESS')
      } else {
        setFormError(data.error || 'Error al reagendar tu sesión Welcome')
      }
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

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

  if (pageState === 'NOT_WELCOME') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-amber-500 text-5xl mb-4">ℹ️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No aplica</h2>
          <p className="text-gray-600">
            {student?.primerNombre}, tu nivel actual no es WELCOME, así que no hay una sesión de bienvenida para reagendar.
          </p>
          <p className="text-gray-500 text-sm mt-2">Si crees que es un error, contacta a tu asesor.</p>
        </div>
      </PageShell>
    )
  }

  if (pageState === 'SUCCESS') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-green-500 text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Listo!</h2>
          <p className="text-gray-600">
            {student?.primerNombre}, tu sesión Welcome quedó reagendada. Te esperamos.
          </p>
        </div>
      </PageShell>
    )
  }

  // ─── FORM ───
  return (
    <PageShell>
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Hola {student?.primerNombre} 👋
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Reagenda tu sesión Welcome. Si ya tenías una agendada, se reemplazará por la nueva fecha.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email — readonly */}
          <div>
            <label htmlFor="rw-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="rw-email"
              type="email"
              value={student?.email || ''}
              readOnly
              title="Email de la cuenta (no modificable)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">El email no puede modificarse.</p>
          </div>

          {/* Foto (opcional, editable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tu foto <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="flex items-center gap-4">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
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

          {/* Agenda tu sesión Welcome (editable) */}
          <div>
            <label htmlFor="rw-welcome" className="block text-sm font-medium text-gray-700 mb-1">
              Agenda tu sesión Welcome
            </label>
            {hasWelcomeBooking && (
              <p className="text-xs text-amber-600 mb-1">Ya tienes una sesión agendada — al elegir una fecha nueva, la anterior se cancela.</p>
            )}
            {welcomeEvents.length > 0 ? (
              <select
                id="rw-welcome"
                value={selectedEvent}
                onChange={e => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Selecciona una fecha...</option>
                {welcomeEvents.map(event => (
                  <option key={event._id} value={event._id} disabled={event.lleno}>
                    {formatEventDate(event.dia)}{event.lleno ? ' (LLENO)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 italic">No hay sesiones Welcome disponibles en este momento.</p>
            )}
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || uploadingPhoto || welcomeEvents.length === 0}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Guardando...' : 'Reagendar sesión Welcome'}
          </button>
        </form>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">LGS</div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Let&apos;s Go Speak</h1>
            <p className="text-xs text-gray-500">Reagendar sesión Welcome</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t bg-white mt-12">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          Let&apos;s Go Speak &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  )
}
