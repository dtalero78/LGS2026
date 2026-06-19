'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AprobacionPermission } from '@/types/permissions'
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

export default function ConversionTitularPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={AprobacionPermission.CONVERSION_TITULAR_VER}>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <ArrowsRightLeftIcon className="h-7 w-7 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Conversión Titular</h1>
              <p className="text-sm text-gray-500">Proceso de conversión de titular.</p>
            </div>
          </div>

          {/* Placeholder — el proceso se desarrollará más tarde */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
            <ArrowsRightLeftIcon className="h-12 w-12 text-indigo-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">En construcción</p>
            <p className="text-xs text-gray-400 mt-1">
              Aquí irá el proceso de Conversión Titular. Próximamente.
            </p>
          </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
