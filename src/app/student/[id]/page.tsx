import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import StudentTabs from '@/components/student/StudentTabs'
import { getStudentById } from '@/lib/wix'
import { PermissionGuard } from '@/components/permissions'
import { StudentPermission } from '@/types/permissions'
import { formatDateTimeColombia } from '@/lib/utils'

// Force dynamic rendering to prevent page caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface StudentPageProps {
  params: {
    id: string
  }
}

export default async function StudentPage({ params }: StudentPageProps) {
  return (
    <DashboardLayout>
      <PermissionGuard permission={StudentPermission.ENVIAR_MENSAJE}>
        <Suspense fallback={<StudentPageLoading />}>
          <StudentContent studentId={params.id} />
        </Suspense>
      </PermissionGuard>
    </DashboardLayout>
  )
}

async function StudentContent({ studentId }: { studentId: string }) {
  try {
    const studentData = await getStudentById(studentId)

    if (!studentData.success || !studentData.student) {
      notFound()
    }

    // DEBUG: Ver qué datos estamos recibiendo
    console.log('🔍 DEBUG Student Data:', {
      numeroId: studentData.student.numeroId,
      contrato: studentData.student.contrato,
      tipoUsuario: studentData.student.tipoUsuario,
      estadoInactivo: studentData.student.estadoInactivo,
      onHoldCount: studentData.student.onHoldCount,
      onHoldHistory: studentData.student.onHoldHistory,
      allFields: Object.keys(studentData.student)
    })

    // Find next scheduled class
    const now = new Date()
    const nextClass = (studentData.classes || [])
      .filter((cls: any) => {
        const classDate = new Date(cls.fechaEvento)
        return classDate > now
      })
      .sort((a: any, b: any) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime())[0]

    // Check if contract has expired
    const contratoFinalizado = studentData.student.finalContrato ?
      new Date(studentData.student.finalContrato) < now : false

    return (
      <div className="space-y-6">
        {/* Student Header */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {studentData.student.primerNombre} {studentData.student.primerApellido}
              </h1>
              <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                <span>ID: {studentData.student.numeroId || 'No disponible'}</span>
                <span>Contrato: {studentData.student.contrato || 'No disponible'}</span>
                <span>Nivel: {studentData.student.nivel || 'No asignado'}</span>
                <span>Step: {studentData.student.step || 'No asignado'}</span>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="flex items-center space-x-2">
                <span className="badge badge-info">
                  {studentData.student.tipoUsuario || 'Beneficiario'}
                </span>
                {studentData.student.plataforma && (
                  <span className="badge badge-success">
                    {studentData.student.plataforma}
                  </span>
                )}
                {contratoFinalizado ? (
                  <span className="badge badge-error">
                    ❌ Finalizada
                  </span>
                ) : nextClass ? (
                  <span className="badge badge-warning">
                    Próxima Sesión: {formatDateTimeColombia(nextClass.fechaEvento)}
                  </span>
                ) : (
                  <span className="badge badge-secondary">
                    Próxima Sesión: Sin sesión futura
                  </span>
                )}
              </div>
              {/* OnHold Indicator - Hide if contract is finalized */}
              {!contratoFinalizado && studentData.student.estadoInactivo && (
                <span className="badge badge-warning">
                  ⏸️ OnHold
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Student Tabs */}
        <StudentTabs
          student={studentData.student}
          classes={studentData.classes || []}
          contratoFinalizado={contratoFinalizado}
        />
      </div>
    )
  } catch (error) {
    console.error('Error loading student:', error)
    notFound()
  }
}

function StudentPageLoading() {
  return (
    <div className="space-y-6">
      <div className="card animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-96"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-6 bg-gray-200 rounded w-20"></div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  )
}