'use client'

import { useState, Suspense } from 'react'
import {
  HomeIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline'
import {
  useStudentMe,
  useStudentEvents,
  useStudentStats,
  useStudentPanelProgress,
  useStudentHistory,
  useStudentMaterials,
  useStudentComments,
  useCancelBooking,
} from '@/hooks/use-panel-estudiante'

import StudentHeader from '@/components/panel-estudiante/StudentHeader'
import NextClassCard from '@/components/panel-estudiante/NextClassCard'
import MyEventsSection from '@/components/panel-estudiante/MyEventsSection'
import AttendanceStats from '@/components/panel-estudiante/AttendanceStats'
import BookingFlow from '@/components/panel-estudiante/BookingFlow'
import ProgressReport from '@/components/panel-estudiante/ProgressReport'
import ClassHistory from '@/components/panel-estudiante/ClassHistory'
import MaterialsList from '@/components/panel-estudiante/MaterialsList'
import WhatsAppContacts from '@/components/panel-estudiante/WhatsAppContacts'
import AdvisorComments from '@/components/panel-estudiante/AdvisorComments'

type Tab = 'inicio' | 'agendar' | 'progreso' | 'historial' | 'material'

const TABS: { key: Tab; label: string; icon: typeof HomeIcon }[] = [
  { key: 'inicio', label: 'Inicio', icon: HomeIcon },
  { key: 'agendar', label: 'Agendar', icon: CalendarDaysIcon },
  { key: 'progreso', label: 'Progreso', icon: ChartBarIcon },
  { key: 'historial', label: 'Historial', icon: ClockIcon },
  { key: 'material', label: 'Material', icon: BookOpenIcon },
]

function PanelEstudianteContent() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio')
  const [showBookingFlow, setShowBookingFlow] = useState(false)

  // Queries
  const meQuery = useStudentMe()
  const eventsQuery = useStudentEvents()
  const statsQuery = useStudentStats()
  const progressQuery = useStudentPanelProgress()
  const historyQuery = useStudentHistory()
  const materialsQuery = useStudentMaterials()
  const commentsQuery = useStudentComments()

  // Mutations
  const cancelMutation = useCancelBooking()

  const profile = meQuery.data?.profile

  const handleCancel = (bookingId: string) => {
    if (confirm('Estas seguro de que quieres cancelar esta clase?')) {
      cancelMutation.mutate(bookingId)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 pb-24 pt-4">
        {/* Header always visible */}
        <StudentHeader profile={profile} isLoading={meQuery.isLoading} />

        <div className="mt-4 space-y-4">
          {/* ── Tab: Inicio ── */}
          {activeTab === 'inicio' && (
            <>
              <NextClassCard
                events={eventsQuery.data?.events || []}
                isLoading={eventsQuery.isLoading}
              />
              <AttendanceStats
                stats={statsQuery.data?.stats}
                isLoading={statsQuery.isLoading}
              />
              <MyEventsSection
                events={eventsQuery.data?.events || []}
                isLoading={eventsQuery.isLoading}
                onCancel={handleCancel}
                isCancelling={cancelMutation.isLoading}
              />
              <WhatsAppContacts />
            </>
          )}

          {/* ── Tab: Agendar ── */}
          {activeTab === 'agendar' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Agendar Clase
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Selecciona una fecha y horario para agendar tu proxima clase.
              </p>
              <button
                onClick={() => setShowBookingFlow(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <CalendarDaysIcon className="h-5 w-5" />
                Buscar Clases Disponibles
              </button>
              <div className="mt-4 text-xs text-gray-400 space-y-1">
                <p>Limite semanal: 2 sesiones, 3 clubs</p>
                <p>Solo puedes agendar 1 sesion por dia</p>
                <p>Cancelacion permitida hasta 60 min antes</p>
              </div>
            </div>
          )}

          {/* ── Tab: Progreso ── */}
          {activeTab === 'progreso' && (
            <ProgressReport
              data={progressQuery.data}
              isLoading={progressQuery.isLoading}
            />
          )}

          {/* ── Tab: Historial ── */}
          {activeTab === 'historial' && (
            <>
              <ClassHistory
                data={historyQuery.data}
                isLoading={historyQuery.isLoading}
              />
              <AdvisorComments
                data={commentsQuery.data}
                isLoading={commentsQuery.isLoading}
              />
            </>
          )}

          {/* ── Tab: Material ── */}
          {activeTab === 'material' && (
            <MaterialsList
              data={materialsQuery.data}
              isLoading={materialsQuery.isLoading}
            />
          )}
        </div>
      </div>

      {/* Bottom Tab Bar (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-lg mx-auto flex">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                  isActive
                    ? 'text-primary-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <tab.icon className={`h-5 w-5 ${isActive ? 'text-primary-600' : ''}`} />
                <span className={isActive ? 'font-semibold' : ''}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Booking Flow Modal */}
      {showBookingFlow && (
        <BookingFlow onClose={() => setShowBookingFlow(false)} />
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
