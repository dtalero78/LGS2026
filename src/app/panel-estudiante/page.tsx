'use client'

import { useState, useMemo, Suspense } from 'react'
import {
  CalendarDaysIcon,
  BookOpenIcon,
  ChartBarIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  useStudentMe,
  useStudentEvents,
  useStudentStats,
  useStudentPanelProgress,
  useStudentMaterials,
  useStudentComments,
  useStudentHistory,
  useCancelBooking,
} from '@/hooks/use-panel-estudiante'

import StudentHeader from '@/components/panel-estudiante/StudentHeader'
import MyEventsSection from '@/components/panel-estudiante/MyEventsSection'
import AttendanceStats from '@/components/panel-estudiante/AttendanceStats'
import BookingFlow from '@/components/panel-estudiante/BookingFlow'
import ProgressReport from '@/components/panel-estudiante/ProgressReport'
import MaterialsList from '@/components/panel-estudiante/MaterialsList'
import WhatsAppContacts from '@/components/panel-estudiante/WhatsAppContacts'
import AdvisorComments from '@/components/panel-estudiante/AdvisorComments'
import ClassHistory from '@/components/panel-estudiante/ClassHistory'

function PanelEstudianteContent() {
  const [showBookingFlow, setShowBookingFlow] = useState(false)
  const [bookingTipo, setBookingTipo] = useState<string | undefined>(undefined)
  const [showProgress, setShowProgress] = useState(false)
  const [showMaterials, setShowMaterials] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Queries
  const meQuery = useStudentMe()
  const eventsQuery = useStudentEvents()
  const statsQuery = useStudentStats()
  const progressQuery = useStudentPanelProgress()
  const materialsQuery = useStudentMaterials()
  const commentsQuery = useStudentComments()
  const historyQuery = useStudentHistory()

  // Mutations
  const cancelMutation = useCancelBooking()

  const profile = meQuery.data?.profile
  const events = eventsQuery.data?.events || []

  // Derive next class info for student card
  const nextClass = useMemo(() => {
    if (!events || events.length === 0) return null
    return events[0]
  }, [events])

  const handleCancel = (bookingId: string) => {
    if (confirm('Estas seguro de que quieres cancelar esta clase?')) {
      cancelMutation.mutate(bookingId)
    }
  }

  const openBooking = (tipo?: string) => {
    setBookingTipo(tipo)
    setShowBookingFlow(true)
  }

  const nextEventDate = nextClass ? new Date(nextClass.fechaEvento) : null
  const now = new Date()
  const showZoom = nextClass && nextEventDate
    ? (nextEventDate.getTime() - now.getTime()) / (1000 * 60) <= 5
      && (now.getTime() - nextEventDate.getTime()) / (1000 * 60) <= 10
    : false
  const zoomLink = nextClass?.eventLinkZoom || nextClass?.linkZoom

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. Top Bar: WhatsApp + Greeting + Nivel */}
      <StudentHeader profile={profile} isLoading={meQuery.isLoading} />

      {/* 2. Booking Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="mx-auto px-2 flex flex-wrap items-center gap-3">
          <span className="text-lg font-bold text-primary-700 mr-2">LGS</span>
          <span className="text-sm text-gray-500 mr-1">Booking:</span>
          <button
            onClick={() => openBooking('SESSION')}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <CalendarDaysIcon className="h-4 w-4" />
            Session
          </button>
          <button
            onClick={() => openBooking('CLUB')}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
          >
            <CalendarDaysIcon className="h-4 w-4" />
            Clubs
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setShowMaterials(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <BookOpenIcon className="h-4 w-4" />
            Material
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <BookOpenIcon className="h-4 w-4" />
            Historial
          </button>
          <button
            onClick={() => setShowProgress(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <ChartBarIcon className="h-4 w-4" />
            Como voy?
          </button>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <BookOpenIcon className="h-4 w-4" />
            Instructivo
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6 space-y-6">
        {/* 3. Student Info Card + Attendance Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Student Info Card */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-5 text-white">
            {meQuery.isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-white/20 rounded w-24" />
                <div className="h-4 bg-white/20 rounded w-32" />
                <div className="h-4 bg-white/20 rounded w-28" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-bold uppercase tracking-wide">Next Session</p>
                  <p className="text-sm font-medium text-primary-200">{profile?.nivel || '---'} - {nextClass?.step || profile?.step || '---'}</p>
                </div>
                <div>
                  <span className="text-xs text-primary-200 uppercase tracking-wide">Asesor</span>
                  <p className="text-sm font-medium">
                    {nextClass?.advisorNombre || '---'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-primary-200 uppercase tracking-wide">Fecha</span>
                  <p className="text-sm font-medium">
                    {nextEventDate
                      ? nextEventDate.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '---'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-primary-200 uppercase tracking-wide">Link de Ingreso</span>
                  {showZoom && zoomLink ? (
                    <a
                      href={zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <VideoCameraIcon className="h-4 w-4" />
                      Entrar a Zoom
                    </a>
                  ) : (
                    <p className="text-sm text-primary-200">
                      {zoomLink ? 'Disponible 5 min antes' : '---'}
                    </p>
                  )}
                </div>
                <div className="pt-2 border-t border-white/20">
                  <p className="text-sm text-primary-200 mb-2">Que aprenderas...</p>
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/30 transition-colors"
                  >
                    <VideoCameraIcon className="h-4 w-4" />
                    Ver video
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats Cards + Events stacked */}
          <div className="lg:col-span-2 space-y-4">
            <AttendanceStats
              stats={statsQuery.data?.stats}
              isLoading={statsQuery.isLoading}
            />
            <MyEventsSection
              events={events}
              isLoading={eventsQuery.isLoading}
              onCancel={handleCancel}
              isCancelling={cancelMutation.isLoading}
            />
          </div>
        </div>

        {/* 5. Advisor Comments (full width) */}
        <AdvisorComments
          data={commentsQuery.data}
          isLoading={commentsQuery.isLoading}
        />

        {/* 5. Let's Go assistance */}
        <WhatsAppContacts />
      </div>

      {/* Modals */}
      {showBookingFlow && (
        <BookingFlow
          onClose={() => { setShowBookingFlow(false); setBookingTipo(undefined) }}
          initialTipo={bookingTipo}
        />
      )}

      {showProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-900">Como voy?</h2>
              <button
                onClick={() => setShowProgress(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <ProgressReport
                data={progressQuery.data}
                isLoading={progressQuery.isLoading}
              />
            </div>
          </div>
        </div>
      )}

      {showMaterials && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-900">Material</h2>
              <button
                onClick={() => setShowMaterials(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <MaterialsList
                data={materialsQuery.data}
                isLoading={materialsQuery.isLoading}
              />
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-5xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-900">Historial de Clases</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <ClassHistory
                data={historyQuery.data}
                isLoading={historyQuery.isLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PanelEstudiantePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        </div>
      }
    >
      <PanelEstudianteContent />
    </Suspense>
  )
}
