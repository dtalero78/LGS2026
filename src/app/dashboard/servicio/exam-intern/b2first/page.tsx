'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ServicioPermission } from '@/types/permissions'

export default function B2FirstPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={ServicioPermission.EXAM_INTERN_B2F_VER}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🎓 Exam. Intern. — B2 First</h1>
          </div>
          <div className="card">
            <div className="card-content py-16 text-center">
              <p className="text-lg font-medium text-gray-700">En construcción</p>
              <p className="text-sm text-gray-500 mt-2">
                Esta página estará disponible próximamente.
              </p>
            </div>
          </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
