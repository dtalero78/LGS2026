import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DashboardStats from '@/components/dashboard/DashboardStats'
import TopStudentsCard from '@/components/dashboard/TopStudentsCard'
import { isAuthDisabled } from '@/lib/utils'

export default async function HomePage() {
  // SIEMPRE verificar auth (comentado el bypass)
  // El Codespaces tiene DISABLE_AUTH=true pero .env.local tiene DISABLE_AUTH=false
  // Por ahora, SIEMPRE verificamos la sesión
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  // Students should not see the admin dashboard
  const userRole = (session.user as any)?.role
  if (userRole === 'ESTUDIANTE') {
    redirect('/panel-estudiante')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel Administrativo</h1>
            <p className="mt-2 text-sm text-gray-700">
              Gestión completa de Let&apos;s Go Speak
            </p>
          </div>
        </div>

        {/* Dashboard Statistics */}
        <Suspense fallback={<DashboardStatsLoading />}>
          <DashboardStats />
        </Suspense>

        {/* Top Students */}
        <Suspense fallback={<div className="card p-6 animate-pulse h-96" />}>
          <TopStudentsCard />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}

function DashboardStatsLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card p-6 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-9 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      ))}
    </div>
  )
}