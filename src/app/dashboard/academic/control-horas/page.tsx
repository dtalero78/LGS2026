'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AcademicoPermission } from '@/types/permissions'
import { ClockIcon } from '@heroicons/react/24/outline'

export default function ControlHorasPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={AcademicoPermission.CONTROL_HORAS_VER} showDefaultMessage>
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <ClockIcon className="h-7 w-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Control Horas</h1>
          </div>

          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
            <div className="text-5xl mb-3">🚧</div>
            <p className="text-lg font-medium text-gray-700">En construcción</p>
            <p className="text-sm text-gray-500 mt-1">Esta sección estará disponible próximamente.</p>
          </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
