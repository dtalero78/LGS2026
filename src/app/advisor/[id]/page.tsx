import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdvisorTabs from '@/components/advisor/AdvisorTabs'
import { PermissionGuard } from '@/components/permissions'
import { AcademicoPermission } from '@/types/permissions'
import { query } from '@/lib/postgres'

interface AdvisorPageProps {
  params: {
    id: string
  }
}

export default async function AdvisorPage({ params }: AdvisorPageProps) {
  return (
    <DashboardLayout>
      <PermissionGuard permission={AcademicoPermission.LISTA_ADVISORS_VER}>
        <Suspense fallback={<AdvisorPageLoading />}>
          <AdvisorContent advisorId={params.id} />
        </Suspense>
      </PermissionGuard>
    </DashboardLayout>
  )
}

async function AdvisorContent({ advisorId }: { advisorId: string }) {
  try {
    console.log('📚 [PostgreSQL] Fetching advisor:', advisorId)

    // Get advisor from PostgreSQL
    const result = await query(
      `SELECT * FROM "ADVISORS" WHERE "_id" = $1`,
      [advisorId]
    )

    if (result.rowCount === 0) {
      notFound()
    }

    const advisor = result.rows[0]
    console.log('✅ [PostgreSQL] Advisor found:', advisor.nombreCompleto)

    return (
      <div className="space-y-6">
        {/* Advisor Header */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  👨‍🏫 {advisor.nombreCompleto}
                </h1>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                  Advisor
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500">
                  {advisor.email && <span>📧 {advisor.email}</span>}
                  {advisor.pais && <span>🌎 {advisor.pais}</span>}
                </div>
                {advisor.telefono && (
                  <div className="flex items-center gap-x-4 text-sm text-gray-500">
                    <span>📱 {advisor.telefono}</span>
                  </div>
                )}
                {advisor.zoom && (
                  <div className="flex items-center gap-x-4 text-sm">
                    <a
                      href={advisor.zoom}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      🔗 Zoom Personal
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Advisor Tabs */}
        <div className="card">
          <AdvisorTabs advisorId={advisorId} advisorName={advisor.nombreCompleto} />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading advisor:', error)
    notFound()
  }
}

function AdvisorPageLoading() {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}