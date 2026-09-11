'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { RecaudosPermission } from '@/types/permissions'
import PagosValidacionPanel from '@/components/recaudos/PagosValidacionPanel'

export default function GestionRecaudosPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={RecaudosPermission.GESTION_VER} showDefaultMessage>
        <PagosValidacionPanel variant="gestor" />
      </PermissionGuard>
    </DashboardLayout>
  )
}
