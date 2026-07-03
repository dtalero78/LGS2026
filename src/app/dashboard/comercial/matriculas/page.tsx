'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import { AcademicCapIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

/**
 * Matrículas (Comercial) — página stub "en construcción".
 * Aquí se desarrollará el proceso de matrículas.
 */
export default function MatriculasPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-6 px-4">
        <div className="flex items-center gap-3 mb-6">
          <AcademicCapIcon className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Matrículas</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <WrenchScrewdriverIcon className="h-7 w-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">En construcción</h2>
          <p className="text-sm text-gray-500">
            El proceso de matrículas se desarrollará en esta sección.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
