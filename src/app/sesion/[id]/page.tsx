'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { CalendarIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PermissionGuard } from '@/components/permissions'
import { AcademicoPermission } from '@/types/permissions'
import SessionTabs from '@/components/session/SessionTabs'
import SessionGeneralTab from '@/components/session/SessionGeneralTab'
import SessionStudentsTab from '@/components/session/SessionStudentsTab'
import SessionMaterialTab from '@/components/session/SessionMaterialTab'

interface CalendarioEvent {
  _id: string
  nombreEvento: string
  evento: 'SESSION' | 'CLUB' | 'WELCOME'
  dia: string
  advisor: string
  tituloONivel: string
  observaciones?: string
  limiteUsuarios: number
  linkZoom?: string
}

interface Student {
  _id: string
  primerNombre: string
  primerApellido: string
  segundoApellido?: string
  email?: string
  celular?: string
  plataforma?: string
  edad?: number
  pais?: string
  hobbies?: string
  foto?: string
  nivel?: string
  step?: string
}

interface ClassRecord {
  _id: string
  idEstudiante: string
  idEvento: string
  asistencia: boolean
  participacion: boolean
  calificacion?: string
  comentarios?: string
  advisorAnotaciones?: string
  actividadPropuesta?: string
  nivel?: string
  step?: string
}

interface StudentWithClass extends Student {
  classRecord?: ClassRecord
}

export default function SesionPage() {
  const params = useParams()
  const router = useRouter()
  const eventoId = params.id as string

  const [loading, setLoading] = useState(true)
  const [evento, setEvento] = useState<CalendarioEvent | null>(null)
  const [students, setStudents] = useState<StudentWithClass[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentWithClass | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (eventoId) {
      loadEventoData()
    }
  }, [eventoId])

  const loadEventoData = async () => {
    try {
      setLoading(true)

      // Cargar datos del evento
      const eventoResponse = await fetch(`/api/wix-proxy/calendario-event?id=${eventoId}`)
      if (!eventoResponse.ok) throw new Error('Error al cargar evento')

      const eventoData = await eventoResponse.json()
      if (!eventoData.success) throw new Error(eventoData.error)

      setEvento(eventoData.event)

      // Cargar estudiantes inscritos
      await loadStudents()

    } catch (err) {
      console.error('Error loading evento:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const loadStudents = async () => {
    try {
      // Obtener bookings del evento
      const bookingsResponse = await fetch('/api/wix-proxy/event-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idEvento: eventoId })
      })

      if (!bookingsResponse.ok) throw new Error('Error al cargar estudiantes')

      const bookingsData = await bookingsResponse.json()

      if (bookingsData.success && bookingsData.bookings) {
        const studentsWithClasses: StudentWithClass[] = bookingsData.bookings.map((booking: any) => ({
          _id: booking.idEstudiante,
          primerNombre: booking.primerNombre,
          primerApellido: booking.primerApellido,
          email: booking.email,
          plataforma: booking.plataforma,
          edad: booking.edad,
          pais: booking.pais,
          hobbies: booking.hobbies || '',
          classRecord: booking.classData
        }))

        setStudents(studentsWithClasses)
      }
    } catch (err) {
      console.error('Error loading students:', err)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando sesión...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !evento) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">{error || 'Evento no encontrado'}</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={AcademicoPermission.IR_A_SESION}>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {evento.tituloONivel} - {evento.nombreEvento}
                </h1>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{format(new Date(evento.dia), "EEEE, d 'de' MMMM", { locale: es })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    <span>{format(new Date(evento.dia), 'HH:mm', { locale: es })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="h-4 w-4" />
                    <span>{students.length} / {evento.limiteUsuarios} estudiantes</span>
                  </div>
                </div>
              </div>
              {evento.linkZoom && (
                <a
                  href={evento.linkZoom}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ir a Zoom
                </a>
              )}
            </div>
          </div>

          {/* Tabs */}
          <SessionTabs>
            {{
              general: (
                <SessionGeneralTab
                  evento={evento}
                  studentCount={students.length}
                />
              ),
              students: (
                <SessionStudentsTab
                  evento={evento}
                  students={students}
                  selectedStudent={selectedStudent}
                  onStudentSelect={setSelectedStudent}
                  onDataUpdate={loadStudents}
                />
              ),
              material: (
                <SessionMaterialTab
                  eventoNombre={evento.nombreEvento}
                />
              )
            }}
          </SessionTabs>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
