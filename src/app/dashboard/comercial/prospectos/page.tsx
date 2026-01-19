import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ComercialPermission } from '@/types/permissions'

export default function ProspectosPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={ComercialPermission.VER_PROSPECTOS}>
        <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎯 Gestión de Prospectos</h1>
          <p className="mt-2 text-sm text-gray-700">
            Administración de clientes potenciales y pipeline comercial
          </p>
        </div>

        <div className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Sistema de Prospectos
            </h3>
            <p className="text-gray-500">
              Aquí se gestionarán los prospectos comerciales y el pipeline de ventas
            </p>
          </div>
        </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}